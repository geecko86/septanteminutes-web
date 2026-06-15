// scripts/transcribe/episodes.mjs
//
// Loads public/js/data.json and resolves the CLI episode selection
// (positional numbers | --season <name|latest> | --all [--missing]).

import fs from 'node:fs';
import path from 'node:path';
import { DATA_JSON_PATH, TRANSCRIPTS_DIR, SCHEMA_VERSION } from './config.mjs';

/**
 * Mirrors src/utils/episodeTitle.ts (kept duplicated because scripts run as
 * plain Node and cannot import the TypeScript source). Titles follow the
 * pattern "Guest Name - Episode Topic" with a hyphen or en-dash separator.
 */
export function getGuestName(title) {
  return title?.split(/\s(-|–)\s?/g)[0]?.trim() ?? '';
}

/**
 * Returns all guest names for multi-guest episodes.
 * "Guest1 & Guest2 - Topic" → ["Guest1", "Guest2"]
 * "Guest - Topic" → ["Guest"]
 */
export function getGuestNames(title) {
  const guestPart = getGuestName(title);
  if (!guestPart) return [];
  return guestPart.split(/\s*[,&]\s*/).map((s) => s.trim()).filter(Boolean);
}

/** Returns the topic portion of a title (everything after the dash). */
export function getEpisodeTopic(title) {
  return title?.split(/\s(-|–)\s?/g)[2]?.trim() ?? '';
}

/** Reads data.json and returns a Map of num -> episode (numeric keys only). */
export function loadEpisodes() {
  const data = JSON.parse(fs.readFileSync(DATA_JSON_PATH, 'utf8'));
  const episodes = new Map();
  for (const key of Object.keys(data.episodes)) {
    if (/^\d+$/.test(key)) episodes.set(key, data.episodes[key]);
  }
  return episodes;
}

/**
 * True when both committed transcript outputs (JSON + VTT) exist AND the JSON
 * carries the current schema version. Outdated or synthetic files (e.g. the
 * version-0 dev fixture) count as missing so the pipeline regenerates them.
 */
export function hasTranscript(num) {
  const jsonPath = path.join(TRANSCRIPTS_DIR, `${num}.json`);
  if (!fs.existsSync(jsonPath) || !fs.existsSync(path.join(TRANSCRIPTS_DIR, `${num}.vtt`))) {
    return false;
  }
  try {
    return JSON.parse(fs.readFileSync(jsonPath, 'utf8')).version === SCHEMA_VERSION;
  } catch {
    return false;
  }
}

/**
 * Resolves the requested selection to an ordered list of episode objects.
 *
 * @param {Map<string, object>} episodes
 * @param {{ nums?: string[], season?: string, all?: boolean, missing?: boolean }} selection
 * @returns {object[]} episodes sorted by ascending number
 */
export function resolveSelection(episodes, { nums = [], season, all = false, missing = false }) {
  let selected;

  if (nums.length > 0) {
    // Expand "84-94"-style ranges into individual episode numbers.
    const expanded = nums.flatMap((token) => {
      const range = /^(\d+)-(\d+)$/.exec(token);
      if (!range) return [token];
      const [from, to] = [Number(range[1]), Number(range[2])];
      if (from > to) {
        throw new Error(`Invalid range "${token}" (start must not exceed end)`);
      }
      return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
    });

    for (const num of expanded) {
      // Episode numbers are used in file paths — validate strictly.
      if (!/^\d+$/.test(num)) {
        throw new Error(`Invalid episode number "${num}" (must be digits only, or a range like 84-94)`);
      }
      if (!episodes.has(num)) {
        throw new Error(`Episode ${num} not found in data.json`);
      }
    }
    selected = [...new Set(expanded)].map((num) => episodes.get(num));
  } else if (season) {
    const seasonName = season === 'latest' ? latestSeason(episodes) : season;
    selected = [...episodes.values()].filter((ep) => ep.season === seasonName);
    if (selected.length === 0) {
      throw new Error(`No episodes found for season "${seasonName}"`);
    }
  } else if (all || missing) {
    // --missing on its own implies --all --missing.
    selected = [...episodes.values()];
  } else {
    throw new Error('No episodes selected (pass episode numbers, --season, --all or --missing)');
  }

  if (missing) {
    selected = selected.filter((ep) => !hasTranscript(ep.num));
  }

  return selected.sort((a, b) => Number(a.num) - Number(b.num));
}

/** Season of the highest-numbered episode. */
function latestSeason(episodes) {
  let latest = null;
  for (const ep of episodes.values()) {
    if (!latest || Number(ep.num) > Number(latest.num)) latest = ep;
  }
  if (!latest?.season) throw new Error('Could not determine the latest season from data.json');
  return latest.season;
}

// scripts/transcribe/manifest.mjs
//
// Rebuilds public/transcripts/manifest.json from the *.vtt directory listing.
// The manifest is the single source of truth for the RSS route and the
// frontend's availability check.

import fs from 'node:fs';
import path from 'node:path';
import { TRANSCRIPTS_DIR, SCHEMA_VERSION, DEFAULT_LANGUAGE, resolveLanguage } from './config.mjs';

/**
 * @returns {{ version: number, episodes: string[], languages: Record<string,string> }}
 *   the manifest written to disk. `languages` lists ONLY the episodes whose
 *   language differs from the French default, so the RSS route can tag them
 *   (everything absent is the default).
 */
export function rebuildManifest() {
  fs.mkdirSync(TRANSCRIPTS_DIR, { recursive: true });

  const episodes = fs
    .readdirSync(TRANSCRIPTS_DIR)
    .filter((file) => file.endsWith('.vtt'))
    .map((file) => file.slice(0, -'.vtt'.length))
    .filter((num) => /^\d+$/.test(num))
    .sort((a, b) => Number(a) - Number(b));

  const languages = {};
  for (const num of episodes) {
    const { tag } = resolveLanguage(num);
    if (tag !== DEFAULT_LANGUAGE) languages[num] = tag;
  }

  const manifest = { version: SCHEMA_VERSION, episodes, languages };
  fs.writeFileSync(path.join(TRANSCRIPTS_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

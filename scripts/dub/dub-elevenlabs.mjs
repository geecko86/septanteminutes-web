#!/usr/bin/env node
// scripts/dub/dub-elevenlabs.mjs
//
// Proof-of-concept dubbing pipeline using ElevenLabs' hosted Dubbing API
// (the "cascade" alternative to the local Hibiki pipeline in dub.mjs).
//
//   node scripts/dub/dub-elevenlabs.mjs 84                    dub episode 84 (full)
//   node scripts/dub/dub-elevenlabs.mjs 84 --clip 184:244     dub only the [184,244]s range
//   node scripts/dub/dub-elevenlabs.mjs 84 --target es --source fr --num-speakers 3
//
// Unlike Hibiki (local, FR->EN only, one chunk at a time), ElevenLabs dubs the
// whole clip server-side in any supported language pair, separating speakers and
// preserving voices. This is a PAID, hosted call — it spends ElevenLabs credits
// on every run — so it defaults to operating on a --clip and caches the result.
//
// Stages:
//   resolve episode -> ensure cached mp3 (reuse downloadAudio) -> ffmpeg-extract
//   the clip to .dub-cache/{num}/eleven-src{suffix}.mp3 (or use the full mp3
//   when no --clip) -> POST multipart to /v1/dubbing -> poll /v1/dubbing/{id}
//   until "dubbed" -> download /v1/dubbing/{id}/audio/{target} ->
//   .dub-cache/{num}/eleven-{target}{suffix}.mp3
//
// This script reads only the gitignored transcription caches; it never
// re-downloads audio that is already present.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT_DIR } from '../transcribe/config.mjs';
import { loadEpisodes, resolveSelection } from '../transcribe/episodes.mjs';
import { downloadAudio } from '../transcribe/download.mjs';

/** Gitignored cache for dubbing artifacts: .dub-cache/{num}/... */
const DUB_CACHE_DIR = path.join(ROOT_DIR, '.dub-cache');

/** ElevenLabs Dubbing API. */
const DUBBING_URL = 'https://api.elevenlabs.io/v1/dubbing';
/** Poll interval and overall timeout while waiting for a job to finish. */
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const HELP = `Usage: node scripts/dub/dub-elevenlabs.mjs <episodeNum> [options]

Dubs a French episode into another language with the ElevenLabs Dubbing API
(hosted, paid). Speakers are separated and their voices preserved server-side.
Because every run spends ElevenLabs credits, use --clip for sanity checks.

Options:
  --clip <a>:<b>       process only the [a,b] second range of the episode
                       (the output filename notes the range)
  --target <lang>      target language code (default en)
  --source <lang>      source language code (default fr)
  --num-speakers <n>   number of speakers to separate (default 2)
  --watermark          add ElevenLabs watermark (required on Free/below-Starter
                       plans; no-watermark dubbing needs Starter+)
  --force              re-run the dub even if the output already exists
  -h, --help           show this help

Prereqs: run \`yarn transcribe <num>\` first so the source mp3 is cached, set
ELEVENLABS_API_KEY in .env.local, and have ffmpeg/ffprobe on PATH.
See scripts/dub/README.md.`;

const log = (msg) => console.log(msg);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

main().catch((error) => {
  console.error(`fatal: ${error.message}`);
  process.exit(1);
});

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      clip: { type: 'string' },
      target: { type: 'string', default: 'en' },
      source: { type: 'string', default: 'fr' },
      'num-speakers': { type: 'string', default: '2' },
      watermark: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(HELP);
    return;
  }
  if (positionals.length > 1) {
    throw new Error(`dub one episode at a time, got: ${positionals.join(', ')}`);
  }

  // --- Validate options ---------------------------------------------------

  const target = values.target.trim();
  const source = values.source.trim();
  if (!target) throw new Error('--target must be a non-empty language code');
  if (!source) throw new Error('--source must be a non-empty language code');

  const numSpeakers = Number(values['num-speakers']);
  if (!Number.isInteger(numSpeakers) || numSpeakers <= 0) {
    throw new Error(`--num-speakers must be a positive integer, got "${values['num-speakers']}"`);
  }

  const clip = values.clip != null ? parseClip(values.clip) : null;

  // --- Secrets & tools ----------------------------------------------------

  const apiKey = loadApiKey();
  ensureTool('ffmpeg');
  ensureTool('ffprobe');

  // --- Resolve the episode (reuse the transcribe selection logic) ---------

  const [episode] = resolveSelection(loadEpisodes(), { nums: positionals });
  const { num } = episode;

  // --- Ensure source mp3 is cached (reuse the download helper) ------------

  const audio = await downloadAudio(episode);
  log(`[${num}] audio: ${audio.cached ? 'cached (skip)' : 'downloaded'} ${path.relative(process.cwd(), audio.path)}`);

  // --- Per-episode cache dir ----------------------------------------------

  const episodeDir = path.join(DUB_CACHE_DIR, String(num));
  fs.mkdirSync(episodeDir, { recursive: true });

  const suffix = clip ? `.clip-${Math.round(clip.start)}-${Math.round(clip.end)}` : '';

  // --- Prepare the source clip (or use the full mp3) ----------------------

  let srcPath;
  if (clip) {
    srcPath = path.join(episodeDir, `eleven-src${suffix}.mp3`);
    if (values.force || !existsNonEmpty(srcPath)) {
      log(`[${num}] extracting clip ${fmt(clip.start)}–${fmt(clip.end)} -> ${path.basename(srcPath)}`);
      runFfmpeg([
        '-y',
        '-ss', String(clip.start),
        '-to', String(clip.end),
        '-i', audio.path,
        '-vn',
        '-acodec', 'libmp3lame',
        '-b:a', '128k',
        srcPath,
      ], 'extracting source clip');
    } else {
      log(`[${num}] clip src cached (skip) ${path.basename(srcPath)}`);
    }
  } else {
    srcPath = audio.path;
  }

  const srcSpan = clip ? clip.end - clip.start : probeDuration(srcPath);

  // --- Output path; skip the (paid) call if already done ------------------

  const outPath = path.join(episodeDir, `eleven-${target}${suffix}.mp3`);
  if (!values.force && existsNonEmpty(outPath)) {
    const outDuration = probeDuration(outPath);
    log(`[${num}] output cached (skip, use --force to redo) -> ${path.relative(process.cwd(), outPath)}`);
    log(`[${num}] duration: dubbed ${fmt(outDuration)}  vs  source ${fmt(srcSpan)}`);
    return;
  }

  // --- Submit the dubbing job ---------------------------------------------

  log(`[${num}] submitting dub ${source}->${target} (${numSpeakers} speaker(s)) for ${fmt(srcSpan)} of audio…`);
  const { dubbingId, expectedDurationSec } = await submitDub({
    apiKey, srcPath, target, source, numSpeakers, watermark: values.watermark,
  });
  log(`[${num}] dubbing_id: ${dubbingId}`);
  if (expectedDurationSec != null) {
    log(`[${num}] expected_duration_sec: ${expectedDurationSec}`);
  }

  // --- Poll until done ----------------------------------------------------

  await pollUntilDubbed({ apiKey, dubbingId, num });

  // --- Download the dubbed audio ------------------------------------------

  log(`[${num}] downloading dubbed ${target} audio…`);
  const bytes = await downloadDub({ apiKey, dubbingId, target });
  fs.writeFileSync(outPath, bytes);

  const outDuration = probeDuration(outPath);
  log('');
  log(`[${num}] done -> ${path.relative(process.cwd(), outPath)}`);
  log(`[${num}] dubbing_id: ${dubbingId}`);
  if (expectedDurationSec != null) {
    log(`[${num}] expected_duration_sec: ${expectedDurationSec}`);
  }
  log(`[${num}] duration: dubbed ${fmt(outDuration)}  vs  source ${fmt(srcSpan)}`);
}

// --- ElevenLabs Dubbing API ----------------------------------------------

/**
 * POSTs the source audio to /v1/dubbing as multipart/form-data and returns the
 * job's { dubbingId, expectedDurationSec }. On a non-OK response the full body
 * is printed and an error thrown.
 */
async function submitDub({ apiKey, srcPath, target, source, numSpeakers, watermark }) {
  const audio = fs.readFileSync(srcPath);
  const form = new FormData();
  form.append('file', new Blob([audio], { type: 'audio/mpeg' }), path.basename(srcPath));
  form.append('target_lang', target);
  form.append('source_lang', source);
  form.append('num_speakers', String(numSpeakers));
  form.append('mode', 'automatic');
  form.append('watermark', String(Boolean(watermark)));

  const res = await fetch(DUBBING_URL, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(body);
    throw new Error(`ElevenLabs dubbing submit failed: HTTP ${res.status}`);
  }

  const json = await res.json();
  const dubbingId = json.dubbing_id;
  if (!dubbingId) {
    console.error(JSON.stringify(json));
    throw new Error('ElevenLabs dubbing submit returned no dubbing_id');
  }
  return { dubbingId, expectedDurationSec: json.expected_duration_sec ?? null };
}

/**
 * Polls GET /v1/dubbing/{id} every POLL_INTERVAL_MS until status is "dubbed".
 * Throws on status "failed", an `error` field, or after POLL_TIMEOUT_MS.
 */
async function pollUntilDubbed({ apiKey, dubbingId, num }) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    const res = await fetch(`${DUBBING_URL}/${dubbingId}`, {
      headers: { 'xi-api-key': apiKey },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(body);
      throw new Error(`ElevenLabs dubbing status check failed: HTTP ${res.status}`);
    }
    const json = await res.json();
    const status = json.status;

    if (json.error) {
      console.error(JSON.stringify(json));
      throw new Error(`ElevenLabs dubbing failed: ${json.error}`);
    }
    if (status === 'dubbed') {
      log(`[${num}] status: dubbed`);
      return;
    }
    if (status === 'failed') {
      console.error(JSON.stringify(json));
      throw new Error('ElevenLabs dubbing failed (status "failed")');
    }

    if (Date.now() >= deadline) {
      throw new Error(`ElevenLabs dubbing timed out after ${Math.round(POLL_TIMEOUT_MS / 60000)} min (last status "${status}")`);
    }
    log(`[${num}] status: ${status ?? 'unknown'} — polling again in ${Math.round(POLL_INTERVAL_MS / 1000)}s`);
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Downloads GET /v1/dubbing/{id}/audio/{target} and returns the raw bytes.
 * Throws (printing the body) on a non-OK response.
 */
async function downloadDub({ apiKey, dubbingId, target }) {
  const res = await fetch(`${DUBBING_URL}/${dubbingId}/audio/${target}`, {
    headers: { 'xi-api-key': apiKey },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(body);
    throw new Error(`ElevenLabs dubbed-audio download failed: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// --- Secrets -------------------------------------------------------------

/**
 * Returns ELEVENLABS_API_KEY. Importing ../transcribe/config.mjs already runs
 * process.loadEnvFile('.env.local'), so under a plain `node` invocation the key
 * is normally present. As a belt-and-braces fallback (and to also consult
 * .env), if it is still unset we manually parse .env.local then .env from
 * ROOT_DIR. The key value is never printed.
 */
function loadApiKey() {
  if (!process.env.ELEVENLABS_API_KEY) {
    for (const name of ['.env.local', '.env']) {
      loadEnvFileInto(path.join(ROOT_DIR, name));
      if (process.env.ELEVENLABS_API_KEY) break;
    }
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ELEVENLABS_API_KEY is not set. Add it to .env.local (gitignored) at the ' +
        'repo root, e.g.  ELEVENLABS_API_KEY=sk_...',
    );
  }
  return apiKey;
}

/**
 * Minimal KEY=VALUE parser for a dotenv file. Populates process.env for any key
 * not already set (so the real environment wins). Ignores blank lines and
 * comments; strips surrounding single/double quotes. No-op if the file is
 * missing. Never logs values.
 */
function loadEnvFileInto(filePath) {
  let text;
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return; // file optional
  }
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// --- External tools ------------------------------------------------------

function runFfmpeg(args, context) {
  const result = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed while ${context} (exit ${result.status})`);
  }
}

/** Returns the duration in seconds of a media file via ffprobe. */
function probeDuration(filePath) {
  const result = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`ffprobe failed on ${filePath}: ${(result.stderr ?? '').trim()}`);
  }
  const seconds = Number(String(result.stdout).trim());
  if (!Number.isFinite(seconds)) {
    throw new Error(`ffprobe returned a non-numeric duration for ${filePath}`);
  }
  return seconds;
}

/** Throws a clear error if a required CLI tool is not on PATH. */
function ensureTool(name) {
  const probe = spawnSync(name, ['-version'], { stdio: 'ignore' });
  if (probe.error) {
    throw new Error(`${name} not found on PATH. Install it (e.g. \`brew install ffmpeg\`).`);
  }
}

// --- Small helpers -------------------------------------------------------

/** Parses "<startSec>:<endSec>" into { start, end } (seconds). */
function parseClip(raw) {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(raw.trim());
  if (!m) throw new Error(`--clip must be "<startSec>:<endSec>" (e.g. 0:60), got "${raw}"`);
  const start = Number(m[1]);
  const end = Number(m[2]);
  if (end <= start) throw new Error(`--clip end (${end}) must be greater than start (${start})`);
  return { start, end };
}

function existsNonEmpty(p) {
  return fs.existsSync(p) && fs.statSync(p).size > 0;
}

/** Formats seconds as m:ss for readable logs. */
function fmt(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = (s - m * 60).toFixed(1).padStart(4, '0');
  return `${m}:${rem}`;
}

#!/usr/bin/env node
// scripts/dub/dub.mjs
//
// Proof-of-concept FR->EN dubbing pipeline for septanteminutes.be.
//
//   node scripts/dub/dub.mjs 95                  dub episode 95 (full)
//   node scripts/dub/dub.mjs 95 --clip 0:60      dub only the first 60s (sanity run)
//   node scripts/dub/dub.mjs 95 --model 1b --cfg-coef 4
//
// Kyutai Hibiki is a local speech-to-speech model (moshi_mlx) that translates
// French speech to English while preserving the speakers' voices. It was
// trained on segments <=120s (40s context), so a ~70-minute episode is split
// into <=90s chunks cut at natural silences, each chunk is translated on its
// own, then the English chunks are concatenated back into one mp3.
//
// Stages (each chunk artifact is skipped when it already exists, unless --force):
//   ensure cached mp3 -> compute silence-based chunk ranges from cached ASR
//   -> ffmpeg-extract each src chunk wav -> Hibiki translate each chunk wav
//   -> ffmpeg concat -> .dub-cache/{num}/en[.clip-a-b].mp3
//
// Hibiki is CC-BY-4.0 and FR->EN only. This script reads only the gitignored
// transcription caches; it never re-charges ElevenLabs or re-downloads audio
// that is already present.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { ROOT_DIR, CACHE_DIR, AUDIO_CACHE_DIR, ASR_CACHE_DIR } from '../transcribe/config.mjs';
import { loadEpisodes, resolveSelection } from '../transcribe/episodes.mjs';
import { downloadAudio } from '../transcribe/download.mjs';

/** Gitignored cache for dubbing artifacts: .dub-cache/{num}/... */
const DUB_CACHE_DIR = path.join(ROOT_DIR, '.dub-cache');

/** HF repos for the two Hibiki MLX checkpoints. */
const HIBIKI_REPOS = {
  '2b': 'kyutai/hibiki-2b-mlx-bf16',
  '1b': 'kyutai/hibiki-1b-mlx-bf16',
};

/** Hard upper bound Hibiki was trained for; --max-chunk-sec must stay under it. */
const HIBIKI_MAX_SEC = 120;

/**
 * When the running chunk reaches the cap we don't cut at the very last word —
 * we look back over this many seconds and cut at the LARGEST inter-word gap in
 * that window, so the boundary lands in a pause rather than mid-sentence.
 */
const SILENCE_LOOKBACK_SEC = 8;

const HELP = `Usage: node scripts/dub/dub.mjs <episodeNum> [options]

Dubs a French episode into English with Kyutai Hibiki (local speech-to-speech),
preserving the speakers' voices. The episode is split into silence-cut chunks,
each chunk is translated, then the English chunks are concatenated.

Options:
  --cfg-coef <n>       voice-similarity knob passed to Hibiki (default 3)
  --model <2b|1b>      Hibiki checkpoint (default 2b)
  --max-chunk-sec <n>  hard cap per chunk in seconds (default 90, must be <120)
  --clip <a>:<b>       process only the [a,b] second range of the episode
                       (quick sanity runs); output filename notes the range
  --python <path>      venv python with moshi_mlx installed
                       (default scripts/dub/.venv/bin/python)
  --force              recompute chunk artifacts even if they already exist
  -h, --help           show this help

Prereqs: run \`yarn transcribe <num>\` first so the source mp3 and ASR cache
exist, and set up the venv (see scripts/dub/README.md).`;

const log = (msg) => console.log(msg);

main().catch((error) => {
  console.error(`fatal: ${error.message}`);
  process.exit(1);
});

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'cfg-coef': { type: 'string', default: '3' },
      model: { type: 'string', default: '2b' },
      'max-chunk-sec': { type: 'string', default: '90' },
      clip: { type: 'string' },
      python: { type: 'string' },
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

  const model = values.model;
  if (!HIBIKI_REPOS[model]) {
    throw new Error(`--model must be 2b or 1b, got "${model}"`);
  }
  const hfRepo = HIBIKI_REPOS[model];

  const maxChunkSec = Number(values['max-chunk-sec']);
  if (!Number.isFinite(maxChunkSec) || maxChunkSec <= 0 || maxChunkSec >= HIBIKI_MAX_SEC) {
    throw new Error(`--max-chunk-sec must be a positive number < ${HIBIKI_MAX_SEC}, got "${values['max-chunk-sec']}"`);
  }

  const cfgCoef = Number(values['cfg-coef']);
  if (!Number.isFinite(cfgCoef) || cfgCoef <= 0) {
    throw new Error(`--cfg-coef must be a positive number, got "${values['cfg-coef']}"`);
  }

  const clip = values.clip != null ? parseClip(values.clip) : null;

  const python = values.python
    ? path.resolve(process.cwd(), values.python)
    : path.join(ROOT_DIR, 'scripts', 'dub', '.venv', 'bin', 'python');
  if (!fs.existsSync(python)) {
    throw new Error(
      `python not found at ${python}. Create the venv and install moshi_mlx:\n` +
        `  python3 -m venv scripts/dub/.venv && scripts/dub/.venv/bin/pip install -U moshi_mlx\n` +
        `(or pass --python <path>). See scripts/dub/README.md.`,
    );
  }
  ensureTool('ffmpeg');
  ensureTool('ffprobe');

  // --- Resolve the episode (reuse the transcribe selection logic) ---------

  const [episode] = resolveSelection(loadEpisodes(), { nums: positionals });
  const { num } = episode;

  // --- Ensure source mp3 is cached (reuse the download helper) ------------

  const audio = await downloadAudio(episode);
  log(`[${num}] audio: ${audio.cached ? 'cached (skip)' : 'downloaded'} ${path.relative(process.cwd(), audio.path)}`);

  // --- Load cached ASR ----------------------------------------------------

  const asrPath = path.join(ASR_CACHE_DIR, `${num}.json`);
  if (!fs.existsSync(asrPath)) {
    throw new Error(
      `ASR cache missing at ${path.relative(process.cwd(), asrPath)}.\n` +
        `Transcribe the episode first:  yarn transcribe ${num}`,
    );
  }
  const asr = JSON.parse(fs.readFileSync(asrPath, 'utf8'));
  // Real words only — drop 'spacing' tokens, which have no meaningful timing.
  const words = (asr.response?.words ?? []).filter((w) => w.type !== 'spacing' && w.start != null && w.end != null);
  if (words.length === 0) {
    throw new Error(`ASR cache at ${path.relative(process.cwd(), asrPath)} has no timed words`);
  }

  // --- Compute chunk ranges -----------------------------------------------

  const audioDuration = probeDuration(audio.path);
  const chunks = computeChunks(words, { maxChunkSec, clip, audioDuration });
  const clipLabel = clip ? ` (clip ${fmt(clip.start)}–${fmt(clip.end)})` : '';
  log(`[${num}] chunks: ${chunks.length} chunk(s)${clipLabel}, cap ${maxChunkSec}s`);
  chunks.forEach((c, i) =>
    log(`  chunk ${i}: ${fmt(c.start)}–${fmt(c.end)} (${fmt(c.end - c.start)})`),
  );

  // --- Per-episode cache dir ----------------------------------------------

  const episodeDir = path.join(DUB_CACHE_DIR, String(num));
  fs.mkdirSync(episodeDir, { recursive: true });

  // --- Extract + translate each chunk (sequential, resumable) -------------

  const enFiles = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const srcPath = path.join(episodeDir, `src-${i}.wav`);
    const enPath = path.join(episodeDir, `en-${i}.wav`);
    enFiles.push(enPath);

    // 1. Extract the source chunk to PCM wav.
    if (values.force || !existsNonEmpty(srcPath)) {
      log(`[${num}] chunk ${i}: extracting ${fmt(chunk.start)}–${fmt(chunk.end)} -> ${path.basename(srcPath)}`);
      runFfmpeg([
        '-y',
        '-ss', String(chunk.start),
        '-to', String(chunk.end),
        '-i', audio.path,
        '-vn',
        '-acodec', 'pcm_s16le',
        srcPath,
      ], `extracting source chunk ${i}`);
    } else {
      log(`[${num}] chunk ${i}: src cached (skip)`);
    }

    // 2. Translate the chunk with Hibiki.
    if (values.force || !existsNonEmpty(enPath)) {
      log(`[${num}] chunk ${i}: Hibiki ${model} translating (cfg-coef ${cfgCoef})…`);
      runHibiki(python, srcPath, enPath, { hfRepo, cfgCoef }, `Hibiki chunk ${i} (${fmt(chunk.start)}–${fmt(chunk.end)})`);
    } else {
      log(`[${num}] chunk ${i}: en cached (skip)`);
    }
  }

  // --- Concatenate -------------------------------------------------------

  const suffix = clip ? `.clip-${Math.round(clip.start)}-${Math.round(clip.end)}` : '';
  const outPath = path.join(episodeDir, `en${suffix}.mp3`);
  concatToMp3(enFiles, outPath, episodeDir);

  const outDuration = probeDuration(outPath);
  const srcSpan = clip ? clip.end - clip.start : audioDuration;
  log('');
  log(`[${num}] done -> ${path.relative(process.cwd(), outPath)}`);
  log(`[${num}] duration: dubbed ${fmt(outDuration)}  vs  source ${fmt(srcSpan)}`);
}

// --- Chunking ------------------------------------------------------------

/**
 * Walks `words` accumulating duration. When adding the next word would push the
 * current chunk past `maxChunkSec`, the chunk is cut at the LARGEST inter-word
 * gap (silence) found within SILENCE_LOOKBACK_SEC of the cap, so boundaries land
 * in pauses and never mid-word. Returns a list of { start, end } ranges (seconds)
 * covering the whole audio (or the clip when set).
 *
 * @param {Array<{ start: number, end: number }>} allWords  timed ASR words
 * @param {{ maxChunkSec: number, clip: ?{start:number,end:number}, audioDuration: number }} opts
 */
function computeChunks(allWords, { maxChunkSec, clip, audioDuration }) {
  // Restrict to the clip range first (keep words that overlap it).
  let words = allWords;
  if (clip) {
    words = allWords.filter((w) => w.end > clip.start && w.start < clip.end);
    if (words.length === 0) {
      throw new Error(`no words fall within --clip ${fmt(clip.start)}–${fmt(clip.end)}`);
    }
  }

  // Range covered: from the clip/audio start to its end, but snapped to the
  // first word's start so we don't translate leading silence redundantly.
  const rangeStart = clip ? clip.start : 0;
  const rangeEnd = clip ? clip.end : audioDuration;

  const chunks = [];
  let chunkStart = Math.max(rangeStart, Math.min(words[0].start, rangeEnd));

  let i = 0;
  while (i < words.length) {
    // Grow the chunk until the NEXT word would exceed the cap.
    let j = i;
    while (j < words.length && words[j].end - chunkStart <= maxChunkSec) {
      j += 1;
    }

    // j is the first word that would overflow (or words.length if we reached
    // the end). Everything [i, j) fits. If even the single word at i is longer
    // than the cap, force-include it (a >maxChunkSec word is pathological but
    // must not loop forever).
    if (j === i) j = i + 1;

    let cutWord = j; // exclusive end index for this chunk
    let chunkEnd;

    if (j >= words.length) {
      // Last chunk: runs to the end of the range.
      chunkEnd = rangeEnd;
      cutWord = words.length;
    } else {
      // Look back from the overflow point for the largest silence gap within
      // SILENCE_LOOKBACK_SEC of the cap, so the boundary sits in a pause.
      // Cutting before word k ends the chunk at words[k-1].end; the gap there
      // is words[k].start - words[k-1].end. The default (no good pause found)
      // is to cut right at the overflow point j.
      const lookbackFloor = chunkStart + maxChunkSec - SILENCE_LOOKBACK_SEC;
      let bestK = j;
      let bestGap = words[j].start - words[j - 1].end;
      for (let k = j - 1; k > i; k--) {
        if (words[k - 1].end < lookbackFloor) break;
        const gap = words[k].start - words[k - 1].end;
        if (gap > bestGap) {
          bestGap = gap;
          bestK = k;
        }
      }
      cutWord = bestK;
      chunkEnd = words[bestK - 1].end;
    }

    chunks.push({ start: round3(chunkStart), end: round3(chunkEnd) });
    i = cutWord;
    chunkStart = chunkEnd;
  }

  // Make the final chunk reach the true range end (covers trailing silence).
  if (chunks.length > 0) chunks[chunks.length - 1].end = round3(rangeEnd);
  return chunks;
}

// --- External tools ------------------------------------------------------

function runFfmpeg(args, context) {
  const result = spawnSync('ffmpeg', args, { stdio: ['ignore', 'ignore', 'inherit'] });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed while ${context} (exit ${result.status})`);
  }
}

/**
 * Runs Hibiki on one chunk. Input is the FIRST positional arg, output wav the
 * SECOND, per Hibiki's documented moshi_mlx usage. stderr is inherited so the
 * model's progress is visible live.
 */
function runHibiki(python, srcPath, enPath, { hfRepo, cfgCoef }, context) {
  const args = [
    '-m', 'moshi_mlx.run_inference',
    srcPath,
    enPath,
    '--hf-repo', hfRepo,
    '--cfg-coef', String(cfgCoef),
  ];
  const result = spawnSync(python, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  if (result.status !== 0) {
    throw new Error(`${context} failed (exit ${result.status}). Command: ${python} ${args.join(' ')}`);
  }
  if (!existsNonEmpty(enPath)) {
    throw new Error(`${context} produced no output at ${enPath}`);
  }
}

/** Concatenates wav chunks (in order) into an mp3 via ffmpeg's concat demuxer. */
function concatToMp3(enFiles, outPath, episodeDir) {
  const listPath = path.join(episodeDir, 'concat.txt');
  // concat demuxer needs absolute paths (or paths relative to the list file),
  // single-quoted with internal quotes escaped.
  const listBody = enFiles
    .map((f) => `file '${path.resolve(f).replace(/'/g, "'\\''")}'`)
    .join('\n');
  fs.writeFileSync(listPath, `${listBody}\n`);

  runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c:a', 'libmp3lame',
    '-b:a', '128k',
    outPath,
  ], 'concatenating English chunks');

  fs.rmSync(listPath, { force: true });
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

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

/** Formats seconds as m:ss for readable logs. */
function fmt(seconds) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rem = (s - m * 60).toFixed(1).padStart(4, '0');
  return `${m}:${rem}`;
}

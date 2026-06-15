// scripts/transcribe/config.mjs
//
// Shared configuration for the transcription pipeline: secrets loading,
// filesystem paths, model identifiers and tuning constants.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (this file lives in scripts/transcribe/). */
export const ROOT_DIR = path.resolve(__dirname, '..', '..');

// Secrets live in .env.local (gitignored). The file may be absent (e.g. CI),
// in which case keys can still come from the process environment.
try {
  process.loadEnvFile(path.join(ROOT_DIR, '.env.local'));
} catch {
  // .env.local is optional
}

// --- Paths ---------------------------------------------------------------

/** Gitignored cache for expensive intermediate artifacts. */
export const CACHE_DIR = path.join(ROOT_DIR, '.transcripts-cache');
/** Downloaded episode MP3s: .transcripts-cache/audio/{num}.mp3 */
export const AUDIO_CACHE_DIR = path.join(CACHE_DIR, 'audio');
/** Raw ElevenLabs responses: .transcripts-cache/asr/{num}.json */
export const ASR_CACHE_DIR = path.join(CACHE_DIR, 'asr');
/** Validated correction chunks: .transcripts-cache/post/{num}/chunk-{i}.json */
export const POST_CACHE_DIR = path.join(CACHE_DIR, 'post');
/** Committed transcript outputs ({num}.json, {num}.vtt, manifest.json). */
export const TRANSCRIPTS_DIR = path.join(ROOT_DIR, 'public', 'transcripts');
/** Episode metadata source of truth. */
export const DATA_JSON_PATH = path.join(ROOT_DIR, 'public', 'js', 'data.json');

// --- Output schema -------------------------------------------------------

/** Version stamped into public/transcripts/{num}.json and manifest.json. */
export const SCHEMA_VERSION = 1;

// --- ElevenLabs Scribe ---------------------------------------------------

export const ELEVENLABS_STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
export const ELEVENLABS_MODEL_ID = 'scribe_v2';
/** Used once when scribe_v2 is rejected (422 / unknown model). */
export const ELEVENLABS_FALLBACK_MODEL_ID = 'scribe_v1';
/** Fixed seed so re-runs are reproducible. */
export const ELEVENLABS_SEED = 70;

// --- Claude post-pass ----------------------------------------------------

/**
 * Model alias passed to the claude CLI. 'opus' deliberately tracks the LATEST
 * Opus (the CLI resolves the alias; chosen after comparing Opus/Sonnet/Haiku/
 * Fable on episode 95 — Opus had the best French erudition + faithfulness).
 * The resolved model id is recorded in each transcript's metadata.
 * Override per run for experiments, e.g.:
 *   TRANSCRIBE_CLAUDE_MODEL=haiku yarn transcribe 95 --redo-claude
 */
export const CLAUDE_CLI_MODEL = process.env.TRANSCRIBE_CLAUDE_MODEL || 'opus';
/**
 * Model id for the @anthropic-ai/sdk fallback backend. The API has no rolling
 * "latest opus" alias (undated ids like claude-opus-4-8 ARE the aliases) —
 * bump this when a new Opus ships.
 */
export const ANTHROPIC_SDK_MODEL = 'claude-opus-4-8';
/**
 * Segments per correction call. Each chunk produces ~3-5k output tokens —
 * far under the model's output cap — and fewer calls amortize the CLI's
 * per-call system-prompt overhead.
 */
export const CHUNK_SIZE = 150;
/**
 * Generous per-chunk timeout for the claude CLI child process. 30 min: under
 * subscription rate-limit pressure the CLI can sit in long internal backoffs
 * (observed >15 min on an otherwise healthy run).
 */
export const LLM_TIMEOUT_MS = 30 * 60 * 1000;
/**
 * Bumped whenever the correction instructions change meaningfully, so the
 * chunk cache (keyed on raw text + this version) re-runs instead of serving
 * corrections produced under an older policy.
 * v1: verbatim (hesitations preserved) — v2: cleaned up (disfluencies removed).
 */
export const CORRECTION_PROMPT_VERSION = 2;

// --- Show metadata -------------------------------------------------------

export const SHOW_NAME = 'Septante Minutes Avec';
export const HOST_NAME = 'Guillaume Hachez';
/** Display name used for the host in transcripts and VTT voice tags. */
export const HOST_DISPLAY_NAME = 'Guillaume Hachez';

// --- Language ------------------------------------------------------------

/** The show is French; this is every episode's language unless overridden. */
export const DEFAULT_LANGUAGE = 'fr';

/**
 * The two episodes conducted entirely in English. Forcing French on them
 * (the hardcoded default everywhere else) makes Scribe mis-transcribe the
 * audio and the Claude pass "correct" English toward French. Keyed by the
 * episode number as it appears in data.json (a string).
 */
export const EPISODE_LANGUAGE_OVERRIDES = { '1': 'en', '27': 'en' };

/**
 * Episodes with a long intro containing many voices (clips, montages…) that
 * exhaust ElevenLabs' diarization capacity, causing it to merge all speakers.
 * Value: the second at which the main interview begins. ASR is split: the
 * intro is transcribed without diarization (all speech attributed to the host),
 * the interview is transcribed with full diarization, then merged.
 */
export const EPISODE_INTERVIEW_OFFSETS = {
  '18': 910,
};

/**
 * Episodes with more than 2 speakers (multiple guests). ElevenLabs Scribe
 * defaults to 2-speaker diarization; these need a higher count so each voice
 * gets its own track. Keyed by episode number string.
 */
export const EPISODE_SPEAKER_COUNTS = {
  '2': 3, '18': 3, '21': 4, '24': 3, '26': 3,
  '34': 3, '38': 3, '42': 3, '47': 3, '63': 3,
};

/**
 * Returns the explicit speaker count override for this episode, or null if
 * ElevenLabs should auto-detect. Only episodes in EPISODE_SPEAKER_COUNTS
 * receive a `num_speakers` hint; all others rely on Scribe's auto-detection.
 */
export function resolveSpeakerCount(num) {
  return EPISODE_SPEAKER_COUNTS[num] ?? null;
}

/**
 * Resolves an episode's language to the codes each stage needs:
 *  - `tag`    : the BCP-47 code stored in the transcript JSON + RSS ('fr'|'en')
 *  - `scribe` : ElevenLabs Scribe's ISO 639-3 code ('fra'|'eng') — a different
 *               standard from `tag` on purpose (Scribe wants 639-3, podcast
 *               apps want BCP-47).
 * Accepts a number or string num (object keys coerce, so both look up the same).
 */
export function resolveLanguage(num) {
  const tag = EPISODE_LANGUAGE_OVERRIDES[num] ?? DEFAULT_LANGUAGE;
  return { tag, scribe: tag === 'en' ? 'eng' : 'fra' };
}

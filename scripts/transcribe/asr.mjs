// scripts/transcribe/asr.mjs
//
// ElevenLabs Scribe call. Raw responses are cached in
// .transcripts-cache/asr/{num}.json so the (paid) ASR step never runs twice.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  ASR_CACHE_DIR,
  ELEVENLABS_STT_URL,
  ELEVENLABS_MODEL_ID,
  ELEVENLABS_FALLBACK_MODEL_ID,
  ELEVENLABS_SEED,
  resolveLanguage,
  resolveSpeakerCount,
  EPISODE_INTERVIEW_OFFSETS,
} from './config.mjs';
import { extractKeyterms } from './keyterms.mjs';

/**
 * Transcribes an episode MP3 with ElevenLabs Scribe (diarized, word-level
 * timestamps), in the episode's configured language (French by default; see
 * resolveLanguage). Returns `{ modelId, response, cached }` where `response`
 * is the raw Scribe payload ({ text, words: [...] }).
 *
 * @param {{ num: string, title?: string }} episode
 * @param {string} audioPath
 * @param {{ force?: boolean, log?: (msg: string) => void }} [options]
 */
export async function transcribeAudio(episode, audioPath, { force = false, log = console.log } = {}) {
  const { scribe: languageCode } = resolveLanguage(episode.num);
  const cachePath = path.join(ASR_CACHE_DIR, `${episode.num}.json`);
  if (!force && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    // A cache fetched under a different language is stale: re-transcribe.
    // (Older caches predate this field — treated as the default 'fra'.)
    const cachedLang = cached.meta?.language ?? 'fra';
    if (cachedLang === languageCode) {
      return { modelId: cached.meta?.modelId ?? ELEVENLABS_MODEL_ID, response: cached.response, cached: true };
    }
    log(`[${episode.num}] asr: cache language ${cachedLang} != ${languageCode}, re-transcribing`);
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY is not set (expected in .env.local)');
  }

  const audio = fs.readFileSync(audioPath);
  // Proper-noun hints: show, host, guest + capitalized terms mined from the
  // episode description (organizations, places, acronyms…).
  const keyterms = extractKeyterms(episode);
  log(`[${episode.num}] asr: ${keyterms.length} keyterms (${keyterms.slice(0, 5).join(', ')}…)`);
  let modelId = ELEVENLABS_MODEL_ID;
  let response;

  const splitSec = EPISODE_INTERVIEW_OFFSETS[episode.num];

  try {
    if (splitSec != null) {
      response = await transcribeWithSplit({ apiKey, modelId, audioPath, episode, keyterms, languageCode, splitSec, log });
    } else {
      response = await callScribe({ apiKey, modelId, audio, episode, keyterms, languageCode, log });
    }
  } catch (error) {
    if (error instanceof UnknownModelError) {
      // Plan: on a 422/unknown-model error, retry once with scribe_v1.
      modelId = ELEVENLABS_FALLBACK_MODEL_ID;
      log(`[${episode.num}] asr: ${ELEVENLABS_MODEL_ID} rejected (${error.message}), retrying with ${modelId}`);
      if (splitSec != null) {
        response = await transcribeWithSplit({ apiKey, modelId, audioPath, episode, keyterms, languageCode, splitSec, log });
      } else {
        response = await callScribe({ apiKey, modelId, audio, episode, keyterms, languageCode, log });
      }
    } else {
      throw error;
    }
  }

  fs.mkdirSync(ASR_CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ meta: { modelId, seed: ELEVENLABS_SEED, language: languageCode, fetchedAt: new Date().toISOString() }, response }),
  );

  return { modelId, response, cached: false };
}

class UnknownModelError extends Error {}

/** Total attempts per ASR call before giving up (1 initial + retries). */
const MAX_ASR_ATTEMPTS = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Exponential backoff (capped 30s) with ±25% jitter so parallel retries
 *  don't synchronise into a thundering herd. */
function backoffMs(attempt) {
  const base = Math.min(30000, 1000 * 2 ** (attempt - 1));
  return Math.round(base * (1 + 0.25 * Math.random()));
}

async function callScribe({ apiKey, modelId, audio, episode, keyterms, languageCode, diarize = true, log }) {
  let attempt = 0;
  // Retry 5xx / 429 / network errors with exponential backoff. 429s become
  // likely once ASR runs several episodes in parallel (ElevenLabs caps
  // concurrent requests per account), so a single retry is not enough.
  for (;;) {
    attempt += 1;
    let res;
    try {
      res = await fetch(ELEVENLABS_STT_URL, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        // FormData bodies cannot be reused after a send — rebuild each attempt.
        body: buildForm({ modelId, audio, episode, keyterms, languageCode, diarize }),
      });
    } catch (error) {
      // Node's undici dispatcher aborts after 300s waiting for response
      // headers. Long synchronous Scribe calls can hit it; surface the
      // documented fallback instead of a cryptic fetch failure.
      if (error?.cause?.code === 'UND_ERR_HEADERS_TIMEOUT') {
        throw new Error(
          'ElevenLabs call exceeded Node fetch\'s 300s headers timeout. ' +
            'Add the undici devDependency and wire a dispatcher with headersTimeout: 0 in scripts/transcribe/asr.mjs.',
        );
      }
      if (attempt < MAX_ASR_ATTEMPTS) {
        const waitMs = backoffMs(attempt);
        log(`[${episode.num}] asr: network error (${error.message}), retry ${attempt}/${MAX_ASR_ATTEMPTS - 1} in ${Math.round(waitMs / 1000)}s`);
        await sleep(waitMs);
        continue;
      }
      throw error;
    }

    if (res.ok) return res.json();

    const body = await res.text().catch(() => '');
    if (res.status === 422 && /model/i.test(body)) {
      throw new UnknownModelError(`HTTP 422: ${body.slice(0, 200)}`);
    }
    if ((res.status >= 500 || res.status === 429) && attempt < MAX_ASR_ATTEMPTS) {
      // Honour Retry-After (seconds) when the server sends it; else backoff.
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoffMs(attempt);
      log(`[${episode.num}] asr: HTTP ${res.status}, retry ${attempt}/${MAX_ASR_ATTEMPTS - 1} in ${Math.round(waitMs / 1000)}s`);
      await sleep(waitMs);
      continue;
    }
    throw new Error(`ElevenLabs error HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
}

/**
 * Transcribes an episode whose intro confuses diarization by splitting the
 * audio at `splitSec`: the intro (0..splitSec) is sent without diarization and
 * all its words are assigned to `speaker_0` (the host); the interview
 * (splitSec..end) is sent with full diarization. Interview timestamps are
 * offset by +splitSec before the two halves are merged into one response.
 */
async function transcribeWithSplit({ apiKey, modelId, audioPath, episode, keyterms, languageCode, splitSec, log }) {
  const introTmp = path.join(os.tmpdir(), `ep${episode.num}-intro.mp3`);
  const interviewTmp = path.join(os.tmpdir(), `ep${episode.num}-interview.mp3`);

  log(`[${episode.num}] asr: splitting at ${splitSec}s — intro (no diarize) + interview`);

  for (const [outPath, args] of [
    [introTmp, ['-y', '-i', audioPath, '-t', String(splitSec), '-c', 'copy', introTmp]],
    [interviewTmp, ['-y', '-i', audioPath, '-ss', String(splitSec), '-c', 'copy', interviewTmp]],
  ]) {
    const result = spawnSync('ffmpeg', args, { stdio: 'pipe' });
    if (result.status !== 0) {
      throw new Error(`ffmpeg split failed for ${outPath}: ${(result.stderr ?? result.stdout ?? '').toString().slice(-300)}`);
    }
  }

  let introResponse, interviewResponse;
  try {
    const introAudio = fs.readFileSync(introTmp);
    introResponse = await callScribe({ apiKey, modelId, audio: introAudio, episode, keyterms, languageCode, diarize: false, log });
    const interviewAudio = fs.readFileSync(interviewTmp);
    interviewResponse = await callScribe({ apiKey, modelId, audio: interviewAudio, episode, keyterms, languageCode, diarize: true, log });
  } finally {
    for (const p of [introTmp, interviewTmp]) {
      try { fs.rmSync(p); } catch { /* already gone */ }
    }
  }

  // Force all intro words to the host speaker; offset interview timestamps.
  const introWords = (introResponse.words ?? []).map((w) => ({ ...w, speaker_id: 'speaker_0' }));
  const interviewWords = (interviewResponse.words ?? []).map((w) => ({
    ...w,
    start: (w.start ?? 0) + splitSec,
    end: (w.end ?? 0) + splitSec,
  }));

  return {
    text: [introResponse.text, interviewResponse.text].filter(Boolean).join(' '),
    words: [...introWords, ...interviewWords],
  };
}

function buildForm({ modelId, audio, episode, keyterms, languageCode = 'fra', diarize = true }) {
  const form = new FormData();
  form.append('model_id', modelId);
  form.append('file', new Blob([audio], { type: 'audio/mpeg' }), `${episode.num}.mp3`);
  if (diarize) {
    form.append('diarize', 'true');
    const speakerCount = resolveSpeakerCount(episode.num);
    if (speakerCount != null) form.append('num_speakers', String(speakerCount));
  }
  form.append('language_code', languageCode);
  form.append('timestamps_granularity', 'word');
  form.append('tag_audio_events', 'false');
  form.append('seed', String(ELEVENLABS_SEED));
  // Multipart list parameters are encoded by repeating the field.
  for (const term of keyterms) {
    form.append('keyterms', term);
  }
  return form;
}

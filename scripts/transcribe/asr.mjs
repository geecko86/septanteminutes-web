// scripts/transcribe/asr.mjs
//
// ElevenLabs Scribe call. Raw responses are cached in
// .transcripts-cache/asr/{num}.json so the (paid) ASR step never runs twice.

import fs from 'node:fs';
import path from 'node:path';
import {
  ASR_CACHE_DIR,
  ELEVENLABS_STT_URL,
  ELEVENLABS_MODEL_ID,
  ELEVENLABS_FALLBACK_MODEL_ID,
  ELEVENLABS_SEED,
} from './config.mjs';
import { extractKeyterms } from './keyterms.mjs';

/**
 * Transcribes an episode MP3 with ElevenLabs Scribe (diarized, word-level
 * timestamps, French). Returns `{ modelId, response, cached }` where
 * `response` is the raw Scribe payload ({ text, words: [...] }).
 *
 * @param {{ num: string, title?: string }} episode
 * @param {string} audioPath
 * @param {{ force?: boolean, log?: (msg: string) => void }} [options]
 */
export async function transcribeAudio(episode, audioPath, { force = false, log = console.log } = {}) {
  const cachePath = path.join(ASR_CACHE_DIR, `${episode.num}.json`);
  if (!force && fs.existsSync(cachePath)) {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    return { modelId: cached.meta?.modelId ?? ELEVENLABS_MODEL_ID, response: cached.response, cached: true };
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

  try {
    response = await callScribe({ apiKey, modelId, audio, episode, keyterms, log });
  } catch (error) {
    if (error instanceof UnknownModelError) {
      // Plan: on a 422/unknown-model error, retry once with scribe_v1.
      modelId = ELEVENLABS_FALLBACK_MODEL_ID;
      log(`[${episode.num}] asr: ${ELEVENLABS_MODEL_ID} rejected (${error.message}), retrying with ${modelId}`);
      response = await callScribe({ apiKey, modelId, audio, episode, keyterms, log });
    } else {
      throw error;
    }
  }

  fs.mkdirSync(ASR_CACHE_DIR, { recursive: true });
  fs.writeFileSync(
    cachePath,
    JSON.stringify({ meta: { modelId, seed: ELEVENLABS_SEED, fetchedAt: new Date().toISOString() }, response }),
  );

  return { modelId, response, cached: false };
}

class UnknownModelError extends Error {}

async function callScribe({ apiKey, modelId, audio, episode, keyterms, log }) {
  const form = buildForm({ modelId, audio, episode, keyterms });

  let attempt = 0;
  // Retry once on 5xx/429/timeout per the plan.
  for (;;) {
    attempt += 1;
    let res;
    try {
      res = await fetch(ELEVENLABS_STT_URL, {
        method: 'POST',
        headers: { 'xi-api-key': apiKey },
        // FormData bodies cannot be reused after a send — rebuild on retry.
        body: attempt === 1 ? form : buildForm({ modelId, audio, episode, keyterms }),
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
      if (attempt === 1) {
        log(`[${episode.num}] asr: network error (${error.message}), retrying once`);
        continue;
      }
      throw error;
    }

    if (res.ok) return res.json();

    const body = await res.text().catch(() => '');
    if (res.status === 422 && /model/i.test(body)) {
      throw new UnknownModelError(`HTTP 422: ${body.slice(0, 200)}`);
    }
    if ((res.status >= 500 || res.status === 429) && attempt === 1) {
      log(`[${episode.num}] asr: HTTP ${res.status}, retrying once`);
      continue;
    }
    throw new Error(`ElevenLabs error HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
}

function buildForm({ modelId, audio, episode, keyterms }) {
  const form = new FormData();
  form.append('model_id', modelId);
  form.append('file', new Blob([audio], { type: 'audio/mpeg' }), `${episode.num}.mp3`);
  form.append('diarize', 'true');
  form.append('num_speakers', '2');
  form.append('language_code', 'fra');
  form.append('timestamps_granularity', 'word');
  form.append('tag_audio_events', 'false');
  form.append('seed', String(ELEVENLABS_SEED));
  // Multipart list parameters are encoded by repeating the field.
  for (const term of keyterms) {
    form.append('keyterms', term);
  }
  return form;
}

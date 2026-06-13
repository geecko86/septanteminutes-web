// scripts/transcribe/postprocess.mjs
//
// Claude post-pass:
// - Call A (1/episode): map diarization speaker ids to display names;
// - Call B (chunks of CHUNK_SIZE segments): fix punctuation / casing /
//   spelling / proper nouns only — timestamps never enter the model.
//
// Every chunk is validated (count & index match, per-segment length ratio
// 0.6-1.6x, normalized word similarity >= 0.75); failures retry once with the
// validation error appended to the prompt, then fall back to the raw ASR text.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  CHUNK_SIZE,
  POST_CACHE_DIR,
  CORRECTION_PROMPT_VERSION,
  SHOW_NAME,
  HOST_NAME,
  HOST_DISPLAY_NAME,
} from './config.mjs';
import { getGuestName } from './episodes.mjs';
import { runStructuredPrompt, LlmCallError } from './llm.mjs';

// Cleanup may shrink a segment a lot (hesitations removed) but should rarely
// grow it, and almost every kept word must come from the original utterance.
const MAX_GROWTH_RATIO = 1.3;
const MIN_KEEP_RATIO = 0.3;
const MIN_KEEP_GUARD_WORDS = 10;
const MAX_INVENTED_RATIO = 0.25;
const MAX_INVENTED_FLOOR = 2;
const MAX_EMPTYABLE_WORDS = 6;
const MIN_SPEAKER_CONFIDENCE = 0.5;
const SPEAKER_SAMPLE_SEGMENTS = 50;

/**
 * Runs the full post-pass for one episode.
 *
 * Validated correction chunks are cached under .transcripts-cache/post/ so a
 * failure later in the pipeline (or a re-run) never re-pays Claude for chunks
 * that already succeeded. Pass useChunkCache: false (--redo-claude/--force)
 * to redo corrections from scratch.
 *
 * @param {{ episode: object, words: Array<object>, segments: Array<object>, useChunkCache?: boolean, concurrency?: number, log?: (msg: string) => void }} params
 * @returns {Promise<{ speakers: Record<string, string>, segments: Array<object>, stats: { correctedSegments: number, totalSegments: number, costUsd: number } }>}
 */
export async function postProcess({ episode, words, segments, useChunkCache = true, concurrency = 1, log = console.log }) {
  let costUsd = 0;

  const speakerResult = await mapSpeakers({ episode, words, segments, log });
  costUsd += speakerResult.costUsd;

  const correction = await correctSegments({ episode, segments, useChunkCache, concurrency, log });
  costUsd += correction.costUsd;

  log(
    `[${episode.num}] post: corrected ${correction.correctedSegments}/${segments.length} segments` +
      ` (cost $${costUsd.toFixed(4)})`,
  );

  return {
    speakers: speakerResult.speakers,
    segments: correction.segments,
    stats: { correctedSegments: correction.correctedSegments, totalSegments: segments.length, costUsd },
  };
}

// --- Call A: speaker mapping ----------------------------------------------

async function mapSpeakers({ episode, words, segments, log }) {
  const speakerIds = [...new Set(segments.map((segment) => segment.speaker))];
  const guest = getGuestName(episode.title);

  if (speakerIds.length !== 2) {
    log(`[${episode.num}] post: ${speakerIds.length} speaker(s) detected, using generic labels`);
    return { speakers: genericLabels(speakerIds), costUsd: 0 };
  }

  const stats = speakerWordStats(words);
  const sample = segments
    .slice(0, SPEAKER_SAMPLE_SEGMENTS)
    .map(({ id, speaker, text }) => ({ i: id, speaker, text }));

  const schema = {
    type: 'object',
    properties: {
      host: { type: 'string', enum: speakerIds },
      confidence: { type: 'number' },
    },
    required: ['host', 'confidence'],
    additionalProperties: false,
  };

  const prompt = [
    `Tu analyses la diarisation d'un épisode du podcast belge "${SHOW_NAME}".`,
    `Épisode ${episode.num} : ${episode.title ?? ''}`,
    `Animateur : ${HOST_NAME}. Invité(e) : ${guest || 'inconnu(e)'}.`,
    '',
    `Répartition de la parole : ${speakerIds
      .map((id) => `${id} = ${stats.get(id) ?? 0} mots`)
      .join(', ')}.`,
    '',
    `Voici les ${sample.length} premiers segments (JSON) :`,
    JSON.stringify(sample),
    '',
    "Quel identifiant correspond à l'animateur (celui qui présente l'émission et pose les questions) ?",
    'Réponds en JSON : { "host": <identifiant>, "confidence": <0..1> }.',
  ].join('\n');

  let result;
  try {
    result = await runStructuredPrompt({ prompt, schema, log });
  } catch (error) {
    if (!(error instanceof LlmCallError)) throw error;
    log(`[${episode.num}] post: speaker mapping call failed (${error.message}), using generic labels`);
    return { speakers: genericLabels(speakerIds), costUsd: 0 };
  }

  const { host, confidence } = result.output;
  // Code heuristic cross-check: the host opens the show, so the first
  // speaker is almost always Guillaume.
  const heuristicHost = segments[0]?.speaker;
  if (host !== heuristicHost || !(confidence >= MIN_SPEAKER_CONFIDENCE)) {
    log(
      `[${episode.num}] post: speaker mapping ambiguous (llm=${host}@${confidence}, heuristic=${heuristicHost}), using generic labels`,
    );
    return { speakers: genericLabels(speakerIds), costUsd: result.costUsd };
  }

  const speakers = {};
  for (const id of speakerIds) {
    speakers[id] = id === host ? HOST_DISPLAY_NAME : guest || 'Invité(e)';
  }
  return { speakers, costUsd: result.costUsd };
}

function genericLabels(speakerIds) {
  const labels = {};
  speakerIds.forEach((id, index) => {
    labels[id] = `Voix ${index + 1}`;
  });
  return labels;
}

function speakerWordStats(words) {
  const stats = new Map();
  for (const word of words) {
    if (word.type === 'spacing' || word.speaker_id == null) continue;
    stats.set(word.speaker_id, (stats.get(word.speaker_id) ?? 0) + 1);
  }
  return stats;
}

// --- Call B: chunked corrections ------------------------------------------

async function correctSegments({ episode, segments, useChunkCache, concurrency = 1, log }) {
  const guest = getGuestName(episode.title);
  const corrected = segments.map((segment) => ({ ...segment }));
  let correctedSegments = 0;
  let costUsd = 0;

  const schema = {
    type: 'object',
    properties: {
      segments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            i: { type: 'integer' },
            text: { type: 'string' },
          },
          required: ['i', 'text'],
          additionalProperties: false,
        },
      },
    },
    required: ['segments'],
    additionalProperties: false,
  };

  const chunkCount = Math.ceil(segments.length / CHUNK_SIZE);

  // Chunks are independent (the read-only context tail comes from the RAW
  // segments, never from corrected output), so they can run concurrently —
  // each task touches disjoint segment ids and its own cache file.
  const processChunk = async (chunkIndex) => {
    const chunk = segments.slice(chunkIndex * CHUNK_SIZE, (chunkIndex + 1) * CHUNK_SIZE);
    const chunkLabel = `${chunkIndex + 1}/${chunkCount}`;
    const cachePath = path.join(POST_CACHE_DIR, String(episode.num), `chunk-${chunkIndex}.json`);
    const chunkHash = hashChunk(chunk);

    let byIndex = useChunkCache ? readChunkCache(cachePath, chunkHash) : null;
    if (byIndex) {
      log(`[${episode.num}] post: chunk ${chunkLabel} cached (skip)`);
    } else {
      const previousTail = segments.slice(
        Math.max(0, chunkIndex * CHUNK_SIZE - 2),
        chunkIndex * CHUNK_SIZE,
      );
      const basePrompt = buildCorrectionPrompt({ episode, guest, chunk, previousTail });

      const result = await runChunkWithRetry({
        episode,
        chunk,
        basePrompt,
        schema,
        chunkLabel,
        log,
      });
      costUsd += result.costUsd;
      byIndex = result.byIndex;
      // Only validated successes are cached: failed chunks (raw-ASR fallback)
      // get a fresh attempt on the next run.
      if (byIndex) writeChunkCache(cachePath, chunkHash, byIndex);
    }

    if (!byIndex) return; // both attempts failed -> raw ASR text kept

    for (const segment of chunk) {
      const text = byIndex.get(segment.id);
      const guard = validateSegmentText(segment.text, text);
      if (guard.ok) {
        // Accepted "" means the segment was pure disfluency — the caller
        // drops empty segments before writing outputs.
        corrected[segment.id].text = guard.empty ? '' : text;
        correctedSegments += 1;
      } else {
        log(`[${episode.num}] post: chunk ${chunkIndex + 1} segment ${segment.id} rejected (${guard.reason}), keeping ASR text`);
      }
    }
  };

  await mapWithConcurrency(
    Array.from({ length: chunkCount }, (_, i) => i),
    concurrency,
    processChunk,
  );

  return { segments: corrected, correctedSegments, costUsd };
}

/** Minimal worker pool: runs fn over items with at most `limit` in flight. */
async function mapWithConcurrency(items, limit, fn) {
  let next = 0;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (next < items.length) {
        const index = next++;
        if (index >= items.length) return;
        await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
}

/**
 * Cache key: the correction-policy version + the chunk's segment ids and raw
 * texts (timestamps don't matter). Bumping CORRECTION_PROMPT_VERSION
 * invalidates corrections produced under an older policy.
 */
function hashChunk(chunk) {
  return createHash('sha256')
    .update(JSON.stringify([CORRECTION_PROMPT_VERSION, chunk.map(({ id, text }) => [id, text])]))
    .digest('hex');
}

/** Returns the cached corrections Map, or null on miss/stale/corrupt cache. */
function readChunkCache(cachePath, hash) {
  try {
    const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (cached.hash === hash && Array.isArray(cached.corrections)) {
      return new Map(cached.corrections);
    }
  } catch {
    // absent or unreadable -> miss
  }
  return null;
}

function writeChunkCache(cachePath, hash, byIndex) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify({ hash, corrections: [...byIndex] }));
}

async function runChunkWithRetry({ episode, chunk, basePrompt, schema, chunkLabel, log }) {
  let costUsd = 0;
  let lastError = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const prompt =
      attempt === 1
        ? basePrompt
        : `${basePrompt}\n\nTa réponse précédente était invalide : ${lastError}\nRecommence en respectant strictement les consignes.`;

    let output;
    try {
      const result = await runStructuredPrompt({ prompt, schema, log });
      costUsd += result.costUsd;
      output = result.output;
    } catch (error) {
      if (!(error instanceof LlmCallError)) throw error;
      lastError = error.message;
      log(`[${episode.num}] post: chunk ${chunkLabel} attempt ${attempt} failed (${error.message})`);
      continue;
    }

    const validation = validateChunkOutput(chunk, output);
    if (validation.ok) {
      log(`[${episode.num}] post: chunk ${chunkLabel} ok${attempt > 1 ? ' (retry)' : ''}`);
      return { byIndex: validation.byIndex, costUsd };
    }
    lastError = validation.reason;
    log(`[${episode.num}] post: chunk ${chunkLabel} attempt ${attempt} invalid (${validation.reason})`);
  }

  log(`[${episode.num}] post: chunk ${chunkLabel} failed twice, falling back to raw ASR text`);
  return { byIndex: null, costUsd };
}

function buildCorrectionPrompt({ episode, guest, chunk, previousTail }) {
  const lines = [
    `Tu nettoies la transcription automatique d'un épisode du podcast belge francophone "${SHOW_NAME}" pour la rendre agréable à lire.`,
    '',
    'Consignes strictes :',
    '- Corrige la ponctuation, la casse, l\'orthographe et les noms propres.',
    '- Supprime les disfluences orales : hésitations parasites (« euh », « bah », « ben », « hein » de remplissage), bégaiements et faux départs (« au- aujourd\'hui » → « aujourd\'hui », « c\'est— alors » → « alors »), répétitions involontaires (« je, je donne » → « je donne »).',
    '- Conserve les répétitions volontaires ou emphatiques (« non non non », « très très mal vu ») et les interjections porteuses de sens (« Ah bon ? », « Waouh »).',
    '- Ne reformule JAMAIS : n\'ajoute aucun mot, ne remplace pas le vocabulaire du locuteur, ne résume pas. Préserve le registre oral (« t\'as », « y a », « \'fin »).',
    '- Si un segment ne contient que des hésitations, renvoie "" (texte vide) pour ce segment.',
    '- Préserve le français de Belgique (« septante », « nonante », « GSM », etc.).',
    '- Ne fusionne pas et ne découpe pas les segments : conserve exactement les mêmes index "i" et le même nombre de segments.',
    '',
    `Épisode ${episode.num} : ${episode.title ?? ''}`,
    `Animateur : ${HOST_NAME}. Invité(e) : ${guest || 'inconnu(e)'}.`,
  ];

  const description = stripHtml(episode.desc ?? '');
  if (description) {
    lines.push('', 'Description de l\'épisode (contexte pour les noms propres) :', description);
  }

  if (previousTail.length > 0) {
    lines.push(
      '',
      'Fin du passage précédent (LECTURE SEULE, ne pas inclure dans la réponse) :',
      JSON.stringify(previousTail.map(({ id, speaker, text }) => ({ i: id, speaker, text }))),
    );
  }

  lines.push(
    '',
    'Segments à corriger (JSON) :',
    JSON.stringify(chunk.map(({ id, speaker, text }) => ({ i: id, speaker, text }))),
    '',
    'Réponds en JSON : { "segments": [{ "i": <index>, "text": <texte corrigé> }] } avec exactement les mêmes index.',
  );

  return lines.join('\n');
}

/** Chunk-level guard: array shape, exact count, exact index set. */
export function validateChunkOutput(chunk, output) {
  const items = output?.segments;
  if (!Array.isArray(items)) {
    return { ok: false, reason: 'missing "segments" array' };
  }
  if (items.length !== chunk.length) {
    return { ok: false, reason: `expected ${chunk.length} segments, got ${items.length}` };
  }

  const byIndex = new Map();
  for (const item of items) {
    if (typeof item?.i !== 'number' || typeof item?.text !== 'string') {
      return { ok: false, reason: 'each segment must be { i: number, text: string }' };
    }
    byIndex.set(item.i, item.text);
  }

  for (const segment of chunk) {
    if (!byIndex.has(segment.id)) {
      return { ok: false, reason: `missing segment i=${segment.id}` };
    }
  }
  if (byIndex.size !== chunk.length) {
    return { ok: false, reason: 'duplicate or extraneous segment indexes' };
  }

  return { ok: true, byIndex };
}

/**
 * Per-segment guard for CLEANED-UP corrections. Deleting words (hesitations,
 * stutters, repetitions) is expected; inventing or substituting words is not.
 * - nearly every kept word must come from the original (LCS-based);
 * - the text may shrink a lot but barely grow;
 * - emptying a segment is allowed only for short, pure-disfluency segments.
 *
 * Returns { ok, empty?, reason? } — `empty` marks an accepted "" correction.
 */
export function validateSegmentText(original, candidate) {
  if (typeof candidate !== 'string') {
    return { ok: false, reason: 'missing correction' };
  }
  const originalWords = normalizeWords(original);
  const candidateWords = normalizeWords(candidate);

  if (candidateWords.length === 0) {
    if (originalWords.length <= MAX_EMPTYABLE_WORDS) return { ok: true, empty: true };
    return { ok: false, reason: `emptied a ${originalWords.length}-word segment` };
  }

  const common = lcsLength(originalWords, candidateWords);
  const invented = candidateWords.length - common;
  const inventedAllowance = Math.max(MAX_INVENTED_FLOOR, Math.round(candidateWords.length * MAX_INVENTED_RATIO));
  if (invented > inventedAllowance) {
    return { ok: false, reason: `${invented} word(s) not from the original (max ${inventedAllowance})` };
  }

  if (candidateWords.length > Math.max(originalWords.length * MAX_GROWTH_RATIO, originalWords.length + 2)) {
    return { ok: false, reason: `grew from ${originalWords.length} to ${candidateWords.length} words` };
  }
  if (
    originalWords.length > MIN_KEEP_GUARD_WORDS &&
    candidateWords.length < originalWords.length * MIN_KEEP_RATIO
  ) {
    return { ok: false, reason: `kept only ${candidateWords.length}/${originalWords.length} words` };
  }
  return { ok: true };
}

/**
 * Apostrophes split into separate tokens so elision fixes ("que il" →
 * "qu'il") count as one substitution, not a brand-new word.
 */
function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Length of the longest common subsequence of two word arrays (two-row DP). */
export function lcsLength(a, b) {
  let previous = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    const current = [0];
    for (let j = 1; j <= b.length; j++) {
      current[j] =
        a[i - 1] === b[j - 1]
          ? previous[j - 1] + 1
          : Math.max(previous[j], current[j - 1]);
    }
    previous = current;
  }
  return previous[b.length];
}

/** Minimal HTML-to-text for episode descriptions (proper-noun context). */
export function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

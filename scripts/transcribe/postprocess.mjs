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
  resolveLanguage,
} from './config.mjs';
import { getGuestName, getGuestNames } from './episodes.mjs';
import { runStructuredPrompt, LlmCallError } from './llm.mjs';
import { mapWithConcurrency } from './concurrency.mjs';

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
  const { tag: lang } = resolveLanguage(episode.num);

  const speakerResult = await mapSpeakers({ episode, words, segments, lang, log });
  costUsd += speakerResult.costUsd;

  const correction = await correctSegments({ episode, segments, lang, useChunkCache, concurrency, log });
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

async function mapSpeakers({ episode, words, segments, lang = 'fr', log }) {
  const speakerIds = [...new Set(segments.map((segment) => segment.speaker))];
  const guest = getGuestName(episode.title);

  if (speakerIds.length > 2) {
    return mapMultiSpeakers({ episode, words, segments, speakerIds, lang, log });
  }

  if (speakerIds.length !== 2) {
    log(`[${episode.num}] post: ${speakerIds.length} speaker(s) detected, using generic labels`);
    return { speakers: genericLabels(speakerIds, lang), costUsd: 0 };
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

  const prompt = (
    lang === 'en'
      ? [
          `You are analysing the diarisation of an episode of the Belgian podcast "${SHOW_NAME}".`,
          `Episode ${episode.num}: ${episode.title ?? ''}`,
          `Host: ${HOST_NAME}. Guest: ${guest || 'unknown'}.`,
          '',
          `Speaking share: ${speakerIds
            .map((id) => `${id} = ${stats.get(id) ?? 0} words`)
            .join(', ')}.`,
          '',
          `Here are the first ${sample.length} segments (JSON):`,
          JSON.stringify(sample),
          '',
          'Which identifier is the host (the person presenting the show and asking the questions)?',
          'Answer in JSON: { "host": <identifier>, "confidence": <0..1> }.',
        ]
      : [
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
        ]
  ).join('\n');

  let result;
  try {
    result = await runStructuredPrompt({ prompt, schema, log });
  } catch (error) {
    if (!(error instanceof LlmCallError)) throw error;
    log(`[${episode.num}] post: speaker mapping call failed (${error.message}), using generic labels`);
    return { speakers: genericLabels(speakerIds, lang), costUsd: 0 };
  }

  const { host, confidence } = result.output;
  // Code heuristic cross-check: the host opens the show, so the first
  // speaker is almost always Guillaume.
  const heuristicHost = segments[0]?.speaker;
  if (host !== heuristicHost || !(confidence >= MIN_SPEAKER_CONFIDENCE)) {
    log(
      `[${episode.num}] post: speaker mapping ambiguous (llm=${host}@${confidence}, heuristic=${heuristicHost}), using generic labels`,
    );
    return { speakers: genericLabels(speakerIds, lang), costUsd: result.costUsd };
  }

  const speakers = {};
  for (const id of speakerIds) {
    speakers[id] = id === host ? HOST_DISPLAY_NAME : guest || (lang === 'en' ? 'Guest' : 'Invité(e)');
  }
  return { speakers, costUsd: result.costUsd };
}

async function mapMultiSpeakers({ episode, words, segments, speakerIds, lang, log }) {
  const stats = speakerWordStats(words);
  const sample = segments
    .slice(0, SPEAKER_SAMPLE_SEGMENTS)
    .map(({ id, speaker, text }) => ({ i: id, speaker, text }));
  const guestNames = getGuestNames(episode.title);

  const schema = {
    type: 'object',
    properties: {
      speakers: {
        type: 'object',
        properties: Object.fromEntries(speakerIds.map((id) => [id, { type: 'string' }])),
        required: speakerIds,
        additionalProperties: false,
      },
    },
    required: ['speakers'],
    additionalProperties: false,
  };

  const prompt = (
    lang === 'en'
      ? [
          `You are analysing the diarisation of an episode of the Belgian podcast "${SHOW_NAME}".`,
          `Episode ${episode.num}: ${episode.title ?? ''}`,
          `Host: ${HOST_NAME}. Guests: ${guestNames.join(', ') || 'unknown'}.`,
          '',
          `Speaking share: ${speakerIds.map((id) => `${id} = ${stats.get(id) ?? 0} words`).join(', ')}.`,
          '',
          `Here are the first ${sample.length} segments (JSON):`,
          JSON.stringify(sample),
          '',
          'The host opens the show and asks the questions. Identify the full name of each speaker.',
          `Answer in JSON: { "speakers": { "<id>": "<name>", ... } } mapping all ${speakerIds.length} ids.`,
        ]
      : [
          `Tu analyses la diarisation d'un épisode du podcast belge "${SHOW_NAME}".`,
          `Épisode ${episode.num} : ${episode.title ?? ''}`,
          `Animateur : ${HOST_NAME}. Invité(e)s : ${guestNames.join(', ') || 'inconnu(e)s'}.`,
          '',
          `Répartition de la parole : ${speakerIds.map((id) => `${id} = ${stats.get(id) ?? 0} mots`).join(', ')}.`,
          '',
          `Voici les ${sample.length} premiers segments (JSON) :`,
          JSON.stringify(sample),
          '',
          "L'animateur ouvre l'émission et pose les questions. Identifie le nom complet de chaque intervenant.",
          `Réponds en JSON : { "speakers": { "<id>": "<nom>", ... } } en mappant les ${speakerIds.length} identifiants.`,
        ]
  ).join('\n');

  let result;
  try {
    result = await runStructuredPrompt({ prompt, schema, log });
  } catch (error) {
    if (!(error instanceof LlmCallError)) throw error;
    log(`[${episode.num}] post: multi-speaker mapping failed (${error.message}), using generic labels`);
    return { speakers: genericLabels(speakerIds, lang), costUsd: 0 };
  }

  const { speakers } = result.output;
  const heuristicHost = segments[0]?.speaker;
  if (speakers[heuristicHost] !== HOST_DISPLAY_NAME) {
    log(`[${episode.num}] post: host override (llm said "${speakers[heuristicHost]}", enforcing ${HOST_DISPLAY_NAME})`);
    speakers[heuristicHost] = HOST_DISPLAY_NAME;
  }

  // Dedup: when Claude maps the same display name to multiple ids (e.g. an
  // archive clip voice and the real guest both labelled with the guest's name),
  // keep the id that spoke the most words and genericize the rest.
  const nameToIds = new Map();
  for (const [id, name] of Object.entries(speakers)) {
    if (!nameToIds.has(name)) nameToIds.set(name, []);
    nameToIds.get(name).push(id);
  }
  let extraIndex = 1;
  for (const [, ids] of nameToIds) {
    if (ids.length <= 1) continue;
    ids.sort((a, b) => (stats.get(b) ?? 0) - (stats.get(a) ?? 0));
    for (let i = 1; i < ids.length; i++) {
      const generic = lang === 'en' ? `Guest ${extraIndex++}` : `Invité·e ${extraIndex++}`;
      log(`[${episode.num}] post: dedup ${ids[i]} was "${speakers[ids[i]]}", renamed to "${generic}"`);
      speakers[ids[i]] = generic;
    }
  }

  log(
    `[${episode.num}] post: ${speakerIds.length} speakers — ` +
      speakerIds.map((id) => `${id}=${speakers[id]}`).join(', '),
  );
  return { speakers, costUsd: result.costUsd };
}

function genericLabels(speakerIds, lang = 'fr') {
  const labels = {};
  const word = lang === 'en' ? 'Voice' : 'Voix';
  speakerIds.forEach((id, index) => {
    labels[id] = `${word} ${index + 1}`;
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

async function correctSegments({ episode, segments, lang = 'fr', useChunkCache, concurrency = 1, log }) {
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
      const basePrompt = buildCorrectionPrompt({ episode, guest, chunk, previousTail, lang });

      const result = await runChunkWithRetry({
        episode,
        chunk,
        basePrompt,
        schema,
        chunkLabel,
        lang,
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

async function runChunkWithRetry({ episode, chunk, basePrompt, schema, chunkLabel, lang = 'fr', log }) {
  let costUsd = 0;
  let lastError = '';

  for (let attempt = 1; attempt <= 2; attempt++) {
    const retrySuffix =
      lang === 'en'
        ? `\n\nYour previous response was invalid: ${lastError}\nTry again, strictly following the instructions.`
        : `\n\nTa réponse précédente était invalide : ${lastError}\nRecommence en respectant strictement les consignes.`;
    const prompt = attempt === 1 ? basePrompt : `${basePrompt}${retrySuffix}`;

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

function buildCorrectionPrompt({ episode, guest, chunk, previousTail, lang = 'fr' }) {
  const en = lang === 'en';
  const description = stripHtml(episode.desc ?? '');

  const lines = en
    ? [
        `You are cleaning up the automatic transcription of an episode of the Belgian podcast "${SHOW_NAME}" (this episode is in English) to make it pleasant to read.`,
        '',
        'Strict instructions:',
        '- Fix punctuation, capitalisation, spelling and proper nouns.',
        '- Remove spoken disfluencies: filler hesitations ("uh", "um", "er", filler "you know"/"I mean"), stutters and false starts ("yes- yesterday" → "yesterday", "it\'s— so" → "so"), involuntary repetitions ("I, I think" → "I think").',
        '- Keep deliberate or emphatic repetitions ("no no no", "very very bad") and meaningful interjections ("Oh really?", "Wow").',
        '- NEVER rephrase: do not add any words, do not replace the speaker\'s vocabulary, do not summarise. Preserve the spoken register (contractions like "you\'re", "gonna", "wanna" — keep them as spoken).',
        '- If a segment contains only hesitations, return "" (empty text) for that segment.',
        '- Do not merge or split segments: keep exactly the same "i" indices and the same number of segments.',
        '',
        `Episode ${episode.num}: ${episode.title ?? ''}`,
        `Host: ${HOST_NAME}. Guest: ${guest || 'unknown'}.`,
      ]
    : [
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

  if (description) {
    lines.push(
      '',
      en
        ? 'Episode description (context for proper nouns — it may be in French):'
        : 'Description de l\'épisode (contexte pour les noms propres) :',
      description,
    );
  }

  if (previousTail.length > 0) {
    lines.push(
      '',
      en
        ? 'End of the previous passage (READ-ONLY, do not include in the response):'
        : 'Fin du passage précédent (LECTURE SEULE, ne pas inclure dans la réponse) :',
      JSON.stringify(previousTail.map(({ id, speaker, text }) => ({ i: id, speaker, text }))),
    );
  }

  lines.push(
    '',
    en ? 'Segments to correct (JSON):' : 'Segments à corriger (JSON) :',
    JSON.stringify(chunk.map(({ id, speaker, text }) => ({ i: id, speaker, text }))),
    '',
    en
      ? 'Answer in JSON: { "segments": [{ "i": <index>, "text": <corrected text> }] } with exactly the same indices.'
      : 'Réponds en JSON : { "segments": [{ "i": <index>, "text": <texte corrigé> }] } avec exactement les mêmes index.',
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

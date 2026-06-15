// scripts/transcribe/segments.mjs
//
// Pure, deterministic segmentation of Scribe word streams (unit-tested).
//
// Rules (from the plan):
// - break on speaker change;
// - within a turn break at sentence-final punctuation once the segment
//   reaches >= 120 chars;
// - force-break at 250 chars / 30 s, splitting at the largest inter-word gap;
// - merge fragments < 1.2 s AND < 20 chars into the previous same-speaker
//   segment;
// - text is joined respecting "spacing" tokens.

export const DEFAULT_OPTIONS = {
  sentenceBreakMinChars: 120,
  forceBreakMaxChars: 250,
  forceBreakMaxSeconds: 30,
  mergeMaxSeconds: 1.2,
  mergeMaxChars: 20,
};

/** Trailing sentence-final punctuation, optionally followed by a closing quote/bracket. */
const SENTENCE_END_RE = /[.!?…]["»”')\]]?$/;

/** Minimum cue duration kept when resolving cross-talk overlaps. */
const MIN_SEGMENT_SECONDS = 0.01;

/**
 * Converts a Scribe `words` array into transcript segments.
 *
 * @param {Array<{ text: string, start: number, end: number, type?: string, speaker_id?: string }>} words
 * @param {Partial<typeof DEFAULT_OPTIONS>} [options]
 * @returns {Array<{ id: number, start: number, end: number, speaker: string, text: string, words: [string, number, number][] }>}
 */
export function buildSegments(words, options = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  let segments = groupTurns(words)
    .flatMap((turn) => splitTurn(turn, opts))
    .filter((segment) => segment.text.length > 0);

  segments = mergeFragments(segments, opts);
  enforcePositiveDuration(segments);
  enforceNonOverlap(segments);

  return segments.map((segment, id) => ({
    id,
    start: round3(segment.start),
    end: round3(segment.end),
    speaker: segment.speaker,
    text: segment.text,
    words: segment.words,
  }));
}

/**
 * Remaps speakers holding less than `threshold` of all words (diarization
 * phantoms, e.g. a third voice detected in the jingle) onto their temporal
 * neighbor: the previous kept speaker's id, or the next one at the start.
 *
 * @param {Array<object>} words Scribe words array
 * @param {number} [threshold] fraction of total words below which a speaker is merged
 * @returns {Array<object>} new words array with remapped speaker_id
 */
export function mergePhantomSpeakers(words, threshold = 0.02) {
  const counts = new Map();
  let total = 0;
  for (const word of words) {
    if (word.type === 'spacing' || word.speaker_id == null) continue;
    counts.set(word.speaker_id, (counts.get(word.speaker_id) ?? 0) + 1);
    total += 1;
  }

  const kept = new Set([...counts.keys()].filter((id) => counts.get(id) / total >= threshold));
  if (kept.size === counts.size || kept.size === 0) return words;

  let previousKept = null;
  const firstKept = words.find((w) => kept.has(w.speaker_id))?.speaker_id ?? null;

  return words.map((word) => {
    if (word.speaker_id == null) return word;
    if (kept.has(word.speaker_id)) {
      previousKept = word.speaker_id;
      return word;
    }
    return { ...word, speaker_id: previousKept ?? firstKept };
  });
}

// --- internals -------------------------------------------------------------

/**
 * Groups the word stream into speaker turns. Spacing tokens never start or
 * end a turn; their text becomes the joiner before the following word.
 */
function groupTurns(words) {
  const turns = [];
  let current = null;
  let pendingSpacing = '';

  for (const token of words) {
    if (token.type === 'spacing') {
      pendingSpacing += token.text ?? '';
      continue;
    }
    if (!current || token.speaker_id !== current.speaker) {
      current = { speaker: token.speaker_id, words: [] };
      turns.push(current);
      pendingSpacing = '';
    }
    current.words.push({
      text: token.text,
      start: token.start,
      end: token.end,
      // Joiner between this word and the previous one within the turn —
      // exactly the spacing tokens Scribe emitted (may be empty).
      joiner: current.words.length === 0 ? '' : pendingSpacing,
    });
    pendingSpacing = '';
  }

  return turns;
}

function splitTurn(turn, opts) {
  return splitAtSentences(turn.words, opts)
    .flatMap((piece) => forceSplit(piece, opts))
    .map((piece) => ({
      speaker: turn.speaker,
      start: piece[0].start,
      end: piece[piece.length - 1].end,
      text: pieceText(piece),
      words: piece.map((w) => [w.text, w.start, w.end]),
    }));
}

/** Closes a piece at sentence-final punctuation once it reaches the minimum length. */
function splitAtSentences(turnWords, opts) {
  const pieces = [];
  let piece = [];
  let length = 0;

  for (const word of turnWords) {
    length += (piece.length > 0 ? word.joiner.length : 0) + word.text.length;
    piece.push(word);
    if (length >= opts.sentenceBreakMinChars && SENTENCE_END_RE.test(word.text)) {
      pieces.push(piece);
      piece = [];
      length = 0;
    }
  }
  if (piece.length > 0) pieces.push(piece);
  return pieces;
}

/**
 * Recursively splits pieces exceeding the char/duration caps at the largest
 * inter-word silence, so forced breaks land on natural pauses.
 */
function forceSplit(piece, opts) {
  if (piece.length < 2) return [piece];
  const duration = piece[piece.length - 1].end - piece[0].start;
  if (pieceText(piece).length <= opts.forceBreakMaxChars && duration <= opts.forceBreakMaxSeconds) {
    return [piece];
  }

  let splitIndex = 1;
  let largestGap = -Infinity;
  for (let i = 1; i < piece.length; i++) {
    const gap = piece[i].start - piece[i - 1].end;
    if (gap > largestGap) {
      largestGap = gap;
      splitIndex = i;
    }
  }

  return [
    ...forceSplit(piece.slice(0, splitIndex), opts),
    ...forceSplit(piece.slice(splitIndex), opts),
  ];
}

function pieceText(piece) {
  return piece
    .map((word, i) => (i === 0 ? word.text : word.joiner + word.text))
    .join('')
    .trim();
}

/** Folds short fragments into the previous segment when speakers match. */
function mergeFragments(segments, opts) {
  const merged = [];
  for (const segment of segments) {
    const previous = merged[merged.length - 1];
    const isFragment =
      segment.end - segment.start < opts.mergeMaxSeconds && segment.text.length < opts.mergeMaxChars;
    if (previous && isFragment && previous.speaker === segment.speaker) {
      previous.text = `${previous.text} ${segment.text}`;
      previous.end = segment.end;
      previous.words = previous.words.concat(segment.words);
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

/** Nominal duration granted to zero-duration segments before overlap resolution. */
const NOMINAL_ZERO_DURATION_SECONDS = 1;

/**
 * Scribe occasionally emits zero-duration words for cross-talk interjections
 * (e.g. a one-word "Absolument." from the other speaker with start === end).
 * A segment built from such a word would produce a non-positive VTT cue.
 * Grant it a nominal duration here; enforceNonOverlap then clamps it back to
 * the real gap before the next segment.
 */
function enforcePositiveDuration(segments) {
  for (const segment of segments) {
    if (segment.end < segment.start + MIN_SEGMENT_SECONDS) {
      segment.end = segment.start + NOMINAL_ZERO_DURATION_SECONDS;
    }
  }
}

/**
 * Diarized cross-talk can make a turn's tail overlap the next turn's start.
 * Truncate the earlier segment at the interruption point so cues stay
 * monotonic and non-overlapping (required by the VTT self-lint and by the
 * frontend's binary search).
 */
function enforceNonOverlap(segments) {
  for (let i = 1; i < segments.length; i++) {
    const previous = segments[i - 1];
    const current = segments[i];
    if (current.start < previous.end) {
      previous.end = Math.max(current.start, previous.start + MIN_SEGMENT_SECONDS);
      current.start = Math.max(current.start, previous.end);
      if (current.end < current.start + MIN_SEGMENT_SECONDS) {
        current.end = current.start + MIN_SEGMENT_SECONDS;
      }
    }
  }
}

function round3(value) {
  return Math.round(value * 1000) / 1000;
}

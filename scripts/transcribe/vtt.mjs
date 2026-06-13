// scripts/transcribe/vtt.mjs
//
// Pure transcript JSON -> WebVTT serialization (unit-tested).
// Cues use HH:MM:SS.mmm timestamps (hours always present), <v Name> voice
// tags and XML-escaped text. A self-lint rejects empty, zero-duration,
// overlapping or non-monotonic cues before anything is written.

/** Formats seconds as HH:MM:SS.mmm (hours required by our VTT profile). */
export function formatTimestamp(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new Error(`Invalid timestamp: ${seconds}`);
  }
  const totalMs = Math.round(seconds * 1000);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}.${pad(ms, 3)}`;
}

/** Escapes the characters with special meaning in VTT cue payloads. */
export function escapeVttText(text) {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Validates cue ordering and content; throws on the first violation.
 * Exported so callers (and tests) can lint independently of serialization.
 */
export function lintSegments(segments) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('VTT lint: no segments');
  }
  let previous = null;
  for (const segment of segments) {
    const label = `segment ${segment.id ?? '?'} [${segment.start}-${segment.end}]`;
    if (!segment.text || segment.text.trim().length === 0) {
      throw new Error(`VTT lint: empty cue text (${label})`);
    }
    if (!(segment.end > segment.start)) {
      throw new Error(`VTT lint: non-positive cue duration (${label})`);
    }
    if (previous) {
      if (segment.start < previous.start) {
        throw new Error(`VTT lint: non-monotonic cue start (${label})`);
      }
      if (segment.start < previous.end) {
        throw new Error(`VTT lint: overlapping cues (${label} overlaps [${previous.start}-${previous.end}])`);
      }
    }
    previous = segment;
  }
}

/**
 * Serializes a transcript ({ speakers, segments }) to a WebVTT string.
 *
 * @param {{ speakers?: Record<string, string>, segments: Array<{ id?: number, start: number, end: number, speaker?: string, text: string }> }} transcript
 */
export function transcriptToVtt(transcript) {
  lintSegments(transcript.segments);

  const lines = ['WEBVTT', ''];
  transcript.segments.forEach((segment, index) => {
    const name = transcript.speakers?.[segment.speaker] ?? segment.speaker ?? '';
    lines.push(String(segment.id ?? index + 1));
    lines.push(`${formatTimestamp(segment.start)} --> ${formatTimestamp(segment.end)}`);
    const text = escapeVttText(segment.text.trim());
    lines.push(name ? `<v ${escapeVttText(name)}>${text}` : text);
    lines.push('');
  });

  return lines.join('\n');
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}

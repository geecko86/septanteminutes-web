import { describe, it, expect } from 'vitest';
import { formatTimestamp, escapeVttText, lintSegments, transcriptToVtt } from './vtt.mjs';

function segment(overrides = {}) {
  return { id: 0, start: 0, end: 1, speaker: 'speaker_0', text: 'Bonjour.', ...overrides };
}

describe('formatTimestamp', () => {
  it('always includes the hours component', () => {
    expect(formatTimestamp(0)).toBe('00:00:00.000');
    expect(formatTimestamp(61.23)).toBe('00:01:01.230');
  });

  it('formats timestamps past one hour', () => {
    expect(formatTimestamp(3661.5)).toBe('01:01:01.500');
    expect(formatTimestamp(2 * 3600 + 35 * 60 + 7.042)).toBe('02:35:07.042');
  });

  it('rounds to the nearest millisecond', () => {
    expect(formatTimestamp(1.2345)).toBe('00:00:01.235');
  });

  it('rejects negative and non-finite values', () => {
    expect(() => formatTimestamp(-1)).toThrow(/Invalid timestamp/);
    expect(() => formatTimestamp(Number.NaN)).toThrow(/Invalid timestamp/);
  });
});

describe('escapeVttText', () => {
  it('escapes &, < and > (ampersand first)', () => {
    expect(escapeVttText('A & B <c> &amp;')).toBe('A &amp; B &lt;c&gt; &amp;amp;');
  });
});

describe('transcriptToVtt', () => {
  const transcript = {
    speakers: { speaker_0: 'Guillaume', speaker_1: 'Isabella Lenarduzzi' },
    segments: [
      segment({ id: 0, start: 1.23, end: 8.45, speaker: 'speaker_0', text: 'Bonjour à toutes et à tous.' }),
      segment({ id: 1, start: 8.5, end: 3601.2, speaker: 'speaker_1', text: 'Merci Guillaume.' }),
    ],
  };

  it('produces a WEBVTT document with voice tags and hour-padded cues', () => {
    const vtt = transcriptToVtt(transcript);
    const lines = vtt.split('\n');

    expect(lines[0]).toBe('WEBVTT');
    expect(lines[1]).toBe('');
    expect(vtt).toContain('00:00:01.230 --> 00:00:08.450');
    expect(vtt).toContain('<v Guillaume>Bonjour à toutes et à tous.');
    expect(vtt).toContain('00:00:08.500 --> 01:00:01.200');
    expect(vtt).toContain('<v Isabella Lenarduzzi>Merci Guillaume.');
  });

  it('XML-escapes cue text and speaker names', () => {
    const vtt = transcriptToVtt({
      speakers: { speaker_0: 'A & B' },
      segments: [segment({ text: 'On a dit <septante> & "nonante".' })],
    });
    expect(vtt).toContain('<v A &amp; B>On a dit &lt;septante&gt; &amp; "nonante".');
    // The original unescaped characters never appear in a cue payload.
    expect(vtt).not.toContain('<septante>');
  });

  it('falls back to the raw speaker id when no display name is mapped', () => {
    const vtt = transcriptToVtt({ speakers: {}, segments: [segment()] });
    expect(vtt).toContain('<v speaker_0>Bonjour.');
  });

  it('rejects overlapping cues', () => {
    expect(() =>
      transcriptToVtt({
        segments: [
          segment({ id: 0, start: 0, end: 5 }),
          segment({ id: 1, start: 4.9, end: 8, text: 'Suite.' }),
        ],
      }),
    ).toThrow(/overlapping cues/);
  });

  it('rejects non-monotonic cues', () => {
    expect(() =>
      transcriptToVtt({
        segments: [
          segment({ id: 0, start: 10, end: 12 }),
          segment({ id: 1, start: 5, end: 7, text: 'Avant.' }),
        ],
      }),
    ).toThrow(/non-monotonic|overlapping/);
  });

  it('rejects empty cue text and non-positive durations', () => {
    expect(() => transcriptToVtt({ segments: [segment({ text: '   ' })] })).toThrow(/empty cue text/);
    expect(() => transcriptToVtt({ segments: [segment({ start: 2, end: 2 })] })).toThrow(/non-positive/);
    expect(() => transcriptToVtt({ segments: [] })).toThrow(/no segments/);
  });
});

describe('lintSegments', () => {
  it('accepts back-to-back cues sharing a boundary', () => {
    expect(() =>
      lintSegments([
        segment({ id: 0, start: 0, end: 5 }),
        segment({ id: 1, start: 5, end: 9, text: 'Suite.' }),
      ]),
    ).not.toThrow();
  });
});

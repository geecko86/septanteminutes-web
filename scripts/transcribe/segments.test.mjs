import { describe, it, expect } from 'vitest';
import { buildSegments, mergePhantomSpeakers } from './segments.mjs';

// --- fixture helpers (shaped like real Scribe responses) -------------------

function w(text, start, end, speaker = 'speaker_0') {
  return { text, start, end, type: 'word', speaker_id: speaker };
}

function sp(start, end, speaker = 'speaker_0') {
  return { text: ' ', start, end, type: 'spacing', speaker_id: speaker };
}

/**
 * Converts a sentence into alternating word/spacing tokens starting at `t0`.
 * Returns { words, end } so fixtures can be chained.
 */
function sentenceWords(sentence, t0, speaker = 'speaker_0', { wordDuration = 0.2, gap = 0.05 } = {}) {
  const words = [];
  let t = t0;
  const parts = sentence.split(' ');
  parts.forEach((part, index) => {
    if (index > 0) {
      words.push(sp(t, t + gap, speaker));
      t += gap;
    }
    words.push(w(part, t, t + wordDuration, speaker));
    t += wordDuration;
  });
  return { words, end: t };
}

// --- buildSegments ----------------------------------------------------------

describe('buildSegments', () => {
  it('returns no segments for an empty word stream', () => {
    expect(buildSegments([])).toEqual([]);
  });

  it('breaks on speaker change', () => {
    const a = sentenceWords('Bonjour à toutes et à tous et bienvenue.', 0, 'speaker_0');
    const b = sentenceWords('Merci beaucoup pour cette invitation.', a.end + 0.5, 'speaker_1');
    const segments = buildSegments([...a.words, ...b.words]);

    expect(segments).toHaveLength(2);
    expect(segments[0].speaker).toBe('speaker_0');
    expect(segments[0].text).toBe('Bonjour à toutes et à tous et bienvenue.');
    expect(segments[1].speaker).toBe('speaker_1');
    expect(segments[1].text).toBe('Merci beaucoup pour cette invitation.');
    expect(segments[0].start).toBe(0);
    expect(segments[1].start).toBeCloseTo(a.end + 0.5, 3);
    expect(segments.map((segment) => segment.id)).toEqual([0, 1]);
  });

  it('breaks at sentence-final punctuation only once the segment reaches 120 chars', () => {
    const s1 = 'Je pense que le numérique transforme profondément notre société moderne.';
    const s2 = 'Nous devons réfléchir aux conséquences pour les jeunes générations.';
    const s3 = 'Voilà pourquoi ce débat est absolument essentiel.';
    // Sanity-check the fixture against the thresholds the test relies on.
    expect(s1.length).toBeLessThan(120);
    expect(s1.length + 1 + s2.length).toBeGreaterThanOrEqual(120);
    expect(s1.length + 1 + s2.length).toBeLessThanOrEqual(250);

    const part1 = sentenceWords(s1, 0);
    const part2 = sentenceWords(s2, part1.end + 0.05);
    const part3 = sentenceWords(s3, part2.end + 0.05);
    const segments = buildSegments([...part1.words, sp(part1.end, part1.end + 0.05), ...part2.words, sp(part2.end, part2.end + 0.05), ...part3.words]);

    expect(segments).toHaveLength(2);
    expect(segments[0].text).toBe(`${s1} ${s2}`);
    expect(segments[1].text).toBe(s3);
  });

  it('keeps a short sentence-terminated turn as a single segment', () => {
    const sentence = 'Cette phrase se termine bien avant cent vingt caractères.';
    const { words } = sentenceWords(sentence, 0);
    const segments = buildSegments(words);

    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe(sentence);
  });

  it('force-breaks text over 250 chars at the largest inter-word gap', () => {
    // 20 unpunctuated 15-char words -> 319 chars, no sentence boundary.
    const words = [];
    let t = 0;
    const starts = [];
    const ends = [];
    for (let i = 0; i < 20; i++) {
      if (i > 0) {
        const gap = i === 10 ? 3.0 : 0.05; // largest silence after the 10th word
        words.push(sp(t, t + gap));
        t += gap;
      }
      starts.push(t);
      words.push(w('abcdefghijklmno', t, t + 0.4));
      ends.push(t + 0.4);
      t += 0.4;
    }

    const segments = buildSegments(words);
    expect(segments).toHaveLength(2);
    expect(segments[0].text.length).toBeLessThanOrEqual(250);
    expect(segments[1].text.length).toBeLessThanOrEqual(250);
    // Split exactly at the largest gap (between word 10 and word 11).
    expect(segments[0].end).toBeCloseTo(ends[9], 3);
    expect(segments[1].start).toBeCloseTo(starts[10], 3);
  });

  it('force-breaks segments longer than 30 seconds at the largest gap', () => {
    // 8 words of 1s each; 2s gaps except a 20s silence in the middle.
    const words = [];
    let t = 0;
    const starts = [];
    const ends = [];
    for (let i = 0; i < 8; i++) {
      if (i > 0) {
        const gap = i === 4 ? 20 : 2;
        words.push(sp(t, t + gap));
        t += gap;
      }
      starts.push(t);
      words.push(w('septante', t, t + 1));
      ends.push(t + 1);
      t += 1;
    }

    const segments = buildSegments(words);
    expect(segments).toHaveLength(2);
    expect(segments[0].end).toBeCloseTo(ends[3], 3);
    expect(segments[1].start).toBeCloseTo(starts[4], 3);
    for (const segment of segments) {
      expect(segment.end - segment.start).toBeLessThanOrEqual(30);
    }
  });

  it('merges fragments under 1.2s and 20 chars into the previous same-speaker segment', () => {
    const s1 = 'Je pense que le numérique transforme profondément notre société moderne.';
    const s2 = 'Nous devons réfléchir aux conséquences pour les jeunes générations.';
    const part1 = sentenceWords(s1, 0);
    const part2 = sentenceWords(s2, part1.end + 0.05);
    // Fragment: 6 chars, 0.5s — well under both merge thresholds.
    const fragment = w('Voilà.', part2.end + 0.1, part2.end + 0.6);

    const segments = buildSegments([
      ...part1.words,
      sp(part1.end, part1.end + 0.05),
      ...part2.words,
      sp(part2.end, part2.end + 0.1),
      fragment,
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe(`${s1} ${s2} Voilà.`);
    expect(segments[0].end).toBeCloseTo(fragment.end, 3);
  });

  it('does not merge a short fragment into a different speaker', () => {
    const a = sentenceWords('Est-ce que tu peux nous expliquer ce point en détail ?', 0, 'speaker_0');
    const interjection = w('Oui.', a.end + 0.2, a.end + 0.6, 'speaker_1');
    const b = sentenceWords('Alors reprenons depuis le début de cette histoire.', a.end + 1, 'speaker_0');

    const segments = buildSegments([...a.words, interjection, ...b.words]);
    expect(segments).toHaveLength(3);
    expect(segments[1].speaker).toBe('speaker_1');
    expect(segments[1].text).toBe('Oui.');
  });

  it('joins words respecting spacing tokens (no space when none was emitted)', () => {
    const words = [
      // Elided article split across two tokens with no spacing between them.
      w("C'", 0, 0.1),
      w('est', 0.1, 0.3),
      sp(0.3, 0.35),
      w('vraiment', 0.35, 0.8),
      sp(0.8, 0.85),
      w('super', 0.85, 1.4),
      // Punctuation token attached without a spacing token.
      w('.', 1.4, 1.45),
    ];
    const segments = buildSegments(words);
    expect(segments).toHaveLength(1);
    expect(segments[0].text).toBe("C'est vraiment super.");
  });

  it('truncates cross-talk so segments never overlap', () => {
    const a = sentenceWords('Je voudrais quand même terminer mon idée sur ce sujet précis.', 0, 'speaker_0');
    // speaker_1 interrupts before speaker_0's last word ends.
    const b = sentenceWords('Attends je dois absolument réagir à cette affirmation.', a.end - 0.3, 'speaker_1');

    const segments = buildSegments([...a.words, ...b.words]);
    expect(segments).toHaveLength(2);
    expect(segments[0].end).toBeLessThanOrEqual(segments[1].start);
    expect(segments[0].end).toBeGreaterThan(segments[0].start);
  });

  it('gives zero-duration interjections a positive duration clamped to the next segment', () => {
    // Real-world repro (episode 95 @ 358.25s): Scribe emits a one-word
    // "Absolument." from the guest with start === end, wedged between two
    // host words — a different speaker on both sides, so fragment-merge
    // cannot absorb it.
    const a = sentenceWords('On était assis sur les premiers rangs.', 0, 'speaker_0');
    const words = [
      ...a.words,
      sp(a.end, a.end + 0.43, 'speaker_0'),
      w('Absolument.', a.end + 0.43, a.end + 0.43, 'speaker_1'), // zero duration
      sp(a.end + 0.43, a.end + 0.46, 'speaker_1'),
      ...sentenceWords('Et puis il y a les révolutionnaires.', a.end + 0.46, 'speaker_0').words,
    ];

    const segments = buildSegments(words);
    expect(segments).toHaveLength(3);
    expect(segments[1].text).toBe('Absolument.');
    expect(segments[1].end).toBeGreaterThan(segments[1].start);
    expect(segments[1].end).toBeLessThanOrEqual(segments[2].start);
  });

  it('extends a trailing zero-duration segment by the nominal duration', () => {
    const a = sentenceWords('Voilà merci beaucoup pour cette discussion.', 0, 'speaker_0');
    const words = [
      ...a.words,
      sp(a.end, a.end + 0.2, 'speaker_0'),
      w('Merci.', a.end + 0.2, a.end + 0.2, 'speaker_1'), // zero duration, last segment
    ];

    const segments = buildSegments(words);
    const last = segments[segments.length - 1];
    expect(last.text).toBe('Merci.');
    expect(last.end).toBeGreaterThan(last.start);
  });
});

// --- mergePhantomSpeakers ---------------------------------------------------

describe('mergePhantomSpeakers', () => {
  it('remaps speakers with under 2% of words onto their neighbor', () => {
    const words = [];
    for (let i = 0; i < 60; i++) words.push(w('mot', i, i + 0.5, 'speaker_0'));
    // One phantom word (jingle voice) in the middle: 1/101 < 2%.
    words.push(w('parasite', 60, 60.5, 'speaker_2'));
    for (let i = 0; i < 40; i++) words.push(w('mot', 61 + i, 61.5 + i, 'speaker_1'));

    const merged = mergePhantomSpeakers(words);
    expect(merged.some((word) => word.speaker_id === 'speaker_2')).toBe(false);
    expect(merged[60].speaker_id).toBe('speaker_0'); // previous kept speaker
    expect(merged).toHaveLength(words.length);
  });

  it('keeps real speakers untouched', () => {
    const words = [
      ...Array.from({ length: 50 }, (_, i) => w('mot', i, i + 0.5, 'speaker_0')),
      ...Array.from({ length: 50 }, (_, i) => w('mot', 50 + i, 50.5 + i, 'speaker_1')),
    ];
    expect(mergePhantomSpeakers(words)).toEqual(words);
  });
});

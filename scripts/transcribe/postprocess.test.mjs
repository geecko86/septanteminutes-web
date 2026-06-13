import { describe, it, expect } from 'vitest';
import { validateSegmentText, lcsLength, validateChunkOutput } from './postprocess.mjs';

describe('validateSegmentText (cleanup policy)', () => {
  it('accepts hesitation and filler removal', () => {
    const result = validateSegmentText(
      'Et euh, donc, euh, oui, je pense que, bah, c\'est important.',
      'Et donc, oui, je pense que c\'est important.',
    );
    expect(result.ok).toBe(true);
  });

  it('accepts stutter and false-start removal', () => {
    const result = validateSegmentText(
      'Donc on est là au- aujourd\'hui ensemble pour parler de JUMP.',
      'Donc on est là aujourd\'hui ensemble pour parler de JUMP.',
    );
    expect(result.ok).toBe(true);
  });

  it('accepts involuntary-repetition removal', () => {
    const result = validateSegmentText(
      'Je, je donne quand même la définition du sexisme qui vient du Haut Conseil.',
      'Je donne quand même la définition du sexisme qui vient du Haut Conseil.',
    );
    expect(result.ok).toBe(true);
  });

  it('accepts spelling and elision fixes', () => {
    const result = validateSegmentText(
      'parce que je trouve que il y a une finesse de langage dans ton adelfi',
      'parce que je trouve qu\'il y a une finesse de langage dans ton adelphie',
    );
    expect(result.ok).toBe(true);
  });

  it('rejects paraphrase (words not from the original)', () => {
    const result = validateSegmentText(
      'On était assis sur les premiers rangs et on écoutait le discours attentivement ce jour-là.',
      'Nous occupions des places à l\'avant et nous suivions la présentation avec attention.',
    );
    expect(result.ok).toBe(false);
  });

  it('rejects emptying a substantial segment', () => {
    const result = validateSegmentText(
      'Ce que j\'essaie de montrer c\'est que même en objectivant les choses avec des tableaux',
      '',
    );
    expect(result.ok).toBe(false);
  });

  it('allows emptying a short pure-disfluency segment', () => {
    const result = validateSegmentText('Euh, bah, euh...', '');
    expect(result.ok).toBe(true);
    expect(result.empty).toBe(true);
  });

  it('rejects removing nearly everything from a long segment', () => {
    const result = validateSegmentText(
      'Alors moi je pense vraiment que cette question du sexisme structurel mérite une analyse beaucoup plus profonde que ce qu\'on en fait habituellement dans les médias.',
      'Alors oui.',
    );
    expect(result.ok).toBe(false);
  });

  it('rejects significant growth', () => {
    const result = validateSegmentText(
      'C\'est important.',
      'C\'est extrêmement important pour toute la société belge et au-delà de nos frontières.',
    );
    expect(result.ok).toBe(false);
  });
});

describe('lcsLength', () => {
  it('counts the longest common subsequence', () => {
    expect(lcsLength(['a', 'b', 'c', 'd'], ['a', 'c', 'd'])).toBe(3);
    expect(lcsLength(['a', 'b'], ['c', 'd'])).toBe(0);
    expect(lcsLength([], ['a'])).toBe(0);
  });
});

describe('validateChunkOutput', () => {
  const chunk = [
    { id: 0, text: 'un' },
    { id: 1, text: 'deux' },
  ];

  it('accepts exact index match including empty strings', () => {
    const result = validateChunkOutput(chunk, {
      segments: [
        { i: 0, text: 'Un.' },
        { i: 1, text: '' },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.byIndex.get(1)).toBe('');
  });

  it('rejects count mismatches', () => {
    const result = validateChunkOutput(chunk, { segments: [{ i: 0, text: 'Un.' }] });
    expect(result.ok).toBe(false);
  });
});

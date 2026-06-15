import { describe, it, expect } from 'vitest';
import { extractKeyterms } from './keyterms.mjs';

const EPISODE = {
  title: 'Isabella Lenarduzzi - L\'état du sexisme',
  desc:
    '<p>Pour ce numéro, je discute avec Isabella Lenarduzzi, fondatrice de JUMP. ' +
    'Nous parlons de la nouvelle étude publiée par JUMP, du Haut Conseil, et du sexisme ' +
    'dans les entreprises en Belgique. Elle a reçu le prix de la Région Wallonne.</p>',
};

describe('extractKeyterms', () => {
  it('always includes the show, host and guest', () => {
    const terms = extractKeyterms(EPISODE);
    expect(terms).toContain('Septante Minutes Avec');
    expect(terms).toContain('Guillaume Hachez');
    expect(terms).toContain('Isabella Lenarduzzi');
  });

  it('mines acronyms and capitalized phrases from the description', () => {
    const terms = extractKeyterms(EPISODE);
    expect(terms).toContain('JUMP');
    expect(terms).toContain('Belgique');
    expect(terms).toContain('Région Wallonne');
    expect(terms).toContain('Haut Conseil');
  });

  it('skips grammatical capitals and sentence-initial words', () => {
    const terms = extractKeyterms(EPISODE);
    expect(terms).not.toContain('Pour');
    expect(terms).not.toContain('Nous');
    expect(terms).not.toContain('Elle');
  });

  it('deduplicates case-insensitively (JUMP appears twice in the description)', () => {
    const terms = extractKeyterms(EPISODE);
    expect(terms.filter((t) => t.toLowerCase() === 'jump')).toHaveLength(1);
  });

  it('does not merge names across punctuation', () => {
    const terms = extractKeyterms({
      title: 'X - Y',
      desc: 'On y parle de Paris, Bruxelles et Namur.',
    });
    expect(terms).toContain('Paris');
    expect(terms).toContain('Bruxelles');
    expect(terms).toContain('Namur');
    expect(terms).not.toContain('Paris Bruxelles');
  });

  it('does not merge capitalized phrases across paragraph boundaries', () => {
    const terms = extractKeyterms({
      title: 'Victoria Defraigne - Transidentité',
      desc: '<p>Un livre paru chez Mardaga</p><p>Septante Minutes Avec Elisa Rojas est un autre épisode.</p>',
    });
    expect(terms).toContain('Mardaga');
    expect(terms.some((t) => t.startsWith('Mardaga '))).toBe(false);
  });

  it('never emits keyterms with more than 4 spaces (ElevenLabs limit)', () => {
    const terms = extractKeyterms({
      title: 'A - B',
      desc: 'On cite Le Grand Livre Des Choses Importantes De Belgique plusieurs fois.',
    });
    for (const term of terms) {
      expect(term.split(' ').length - 1).toBeLessThanOrEqual(4);
    }
  });

  it('handles a missing description and caps the list', () => {
    expect(extractKeyterms({ title: 'A - B' }).length).toBeGreaterThan(0);
    const long = {
      title: 'A - B',
      desc: Array.from({ length: 300 }, (_, i) => `Mot${i} Important${i} est cité.`).join(' '),
    };
    expect(extractKeyterms(long).length).toBeLessThanOrEqual(100);
  });
});

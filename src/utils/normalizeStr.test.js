import { describe, it, expect } from 'vitest';
import normalizeString from './normalizeStr';

describe('normalizeString', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(normalizeString('Hello World')).toBe('hello-world');
  });

  it('strips accented characters', () => {
    expect(normalizeString('Élodie Müller')).toBe('elodie-muller');
  });

  it('removes non-word characters', () => {
    expect(normalizeString("Jean-Pierre (Jr.)'s")).toBe('jean-pierre-jrs');
  });

  it('collapses multiple hyphens', () => {
    expect(normalizeString('A  B   C')).toBe('a-b-c');
  });

  it('trims leading and trailing hyphens', () => {
    expect(normalizeString(' - title - ')).toBe('title');
  });

  it('handles en-dash and em-dash', () => {
    expect(normalizeString('titre – sous-titre')).toBe('titre-sous-titre');
  });

  it('handles an already-normalized string unchanged', () => {
    expect(normalizeString('hello-world')).toBe('hello-world');
  });
});

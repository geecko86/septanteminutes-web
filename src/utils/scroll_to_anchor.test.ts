import { describe, it, expect } from 'vitest';
import { getEpisodeNum } from './scroll_to_anchor';

describe('getEpisodeNum', () => {
  it('extracts the fragment from a URL with a hash', () => {
    expect(getEpisodeNum('/?#42')).toBe('42');
    expect(getEpisodeNum('/#episode-5')).toBe('episode-5');
  });

  it('returns empty string when no hash is present', () => {
    expect(getEpisodeNum('/')).toBe('');
    expect(getEpisodeNum('')).toBe('');
  });

  it('returns empty string for undefined/null-ish input', () => {
    expect(getEpisodeNum(undefined as any)).toBe('');
  });
});

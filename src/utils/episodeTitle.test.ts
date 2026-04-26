import { describe, it, expect } from 'vitest';
import { getGuestName, getEpisodeTopic } from './episodeTitle';

describe('getGuestName', () => {
  it('extracts the guest name from a standard hyphen title', () => {
    expect(getGuestName('Alexander De Croo - La politique belge')).toBe('Alexander De Croo');
  });

  it('extracts the guest name from an en-dash title', () => {
    expect(getGuestName('Marie Dupont – Le féminisme')).toBe('Marie Dupont');
  });

  it('returns the full string when there is no separator (no topic)', () => {
    // No dash means split produces a single-element array; index 0 is the whole string.
    expect(getGuestName('Jean-Pierre Martin')).toBe('Jean-Pierre Martin');
  });

  it('returns empty string for undefined input', () => {
    expect(getGuestName(undefined)).toBe('');
  });

  it('trims extra whitespace around the guest name', () => {
    expect(getGuestName('  Alice B.  - Le journalisme')).toBe('Alice B.');
  });
});

describe('getEpisodeTopic', () => {
  it('extracts the topic from a standard hyphen title', () => {
    expect(getEpisodeTopic('Alexander De Croo - La politique belge')).toBe('La politique belge');
  });

  it('extracts the topic from an en-dash title', () => {
    expect(getEpisodeTopic('Marie Dupont – Le féminisme')).toBe('Le féminisme');
  });

  it('returns empty string when there is no topic (no separator)', () => {
    expect(getEpisodeTopic('Jean-Pierre Martin')).toBe('');
  });

  it('returns empty string for undefined input', () => {
    expect(getEpisodeTopic(undefined)).toBe('');
  });

  it('trims extra whitespace around the topic', () => {
    expect(getEpisodeTopic('Alice B. -  Le journalisme  ')).toBe('Le journalisme');
  });
});

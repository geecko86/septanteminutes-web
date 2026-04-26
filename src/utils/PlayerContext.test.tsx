// @vitest-environment jsdom
//
// PlayerContext manages the global audio playback state for the entire app.
// Think of it like a remote control: PlaybackProvider is the remote itself,
// and usePlayback is any component that wants to press a button on it.
//
// jsdom gives us a fake browser environment so React hooks and HTMLAudioElement
// can run — but note that jsdom's Audio is a no-op (it can't actually play sound).
// We test the *state machine* (does pressing play change isPlaying?) not real audio.

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, renderHook } from '@testing-library/react';
import { PlaybackProvider, usePlayback } from './PlayerContext';

// ---------------------------------------------------------------------------
// PlayerContext imports cdn_img_loader which uses process.env vars that may not
// exist in a test environment. The loader itself is not what we're testing, so
// we stub it out to return a predictable URL string.
// ---------------------------------------------------------------------------
vi.mock('./cdn_img_loader', () => ({
  default: ({ src }: { src: string }) => src,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A wrapper that mounts PlaybackProvider around whatever we're testing.
 *  renderHook needs this so the hook has access to the context it depends on. */
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PlaybackProvider>{children}</PlaybackProvider>
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePlayback', () => {
  it('throws when called outside PlaybackProvider', () => {
    // Silence the expected React error boundary console output during this test.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      // renderHook without a wrapper means there is no PlaybackProvider above the hook.
      renderHook(() => usePlayback())
    ).toThrow('usePlayback must be within PlaybackProvider');

    consoleError.mockRestore();
  });

  it('returns the expected shape when inside PlaybackProvider', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });

    // Check every key the context is supposed to expose.
    expect(typeof result.current.isPlaying).toBe('boolean');
    expect(typeof result.current.setPlaying).toBe('function');
    expect(typeof result.current.setPlayingEpisode).toBe('function');
    expect(typeof result.current.setStatus).toBe('function');
    expect(typeof result.current.setAutoplay).toBe('function');
    expect(typeof result.current.status).toBe('number');
    // playingEpisode and autoplay start as undefined — no episode selected yet.
    expect(result.current.playingEpisode).toBeUndefined();
    expect(result.current.autoplay).toBeUndefined();
  });

  it('isPlaying starts as false', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    expect(result.current.isPlaying).toBe(false);
  });

  it('setPlaying(true) changes isPlaying to true', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });

    act(() => {
      result.current.setPlaying(true);
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it('setPlaying(false) changes isPlaying back to false', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });

    act(() => {
      result.current.setPlaying(true);
    });
    act(() => {
      result.current.setPlaying(false);
    });

    expect(result.current.isPlaying).toBe(false);
  });

  it('setPlayingEpisode updates playingEpisode in context', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });

    const fakeEpisode = {
      title: 'Alexander De Croo – Vice premier ministre',
      img: 'https://example.com/1.jpg',
      spotifyLink: '',
      mp3: 'https://example.com/ep1.mp3',
      season: '2018-2019',
      appleLink: '',
      desc: '<p>Test</p>',
      num: '1',
      date: '2018-09-05',
    };

    act(() => {
      result.current.setPlayingEpisode(fakeEpisode);
    });

    // The context should now know which episode is "playing".
    expect(result.current.playingEpisode).toEqual(fakeEpisode);
  });

  it('provider mounts and unmounts cleanly even when navigator.mediaSession is undefined', () => {
    // jsdom does not implement navigator.mediaSession. The component guards every
    // mediaSession access with `if (!navigator.mediaSession) return`, so it should
    // never throw. This test verifies that contract.
    expect(() => {
      const { unmount } = render(<PlaybackProvider><div /></PlaybackProvider>);
      unmount();
    }).not.toThrow();
  });

  it('status starts at 0', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    expect(result.current.status).toBe(0);
  });

  it('setStatus updates status in context', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });

    act(() => {
      result.current.setStatus(4); // 4 means "playing" in HTMLMediaElement readyState terms
    });

    expect(result.current.status).toBe(4);
  });

  it('autoplay starts as undefined and can be set', () => {
    const { result } = renderHook(() => usePlayback(), { wrapper });
    expect(result.current.autoplay).toBeUndefined();

    const fakeEpisode = {
      title: 'Test', img: '', spotifyLink: '', mp3: '', season: '',
      appleLink: '', desc: '', num: '1', date: '',
    };

    act(() => {
      result.current.setAutoplay(fakeEpisode);
    });

    expect(result.current.autoplay).toEqual(fakeEpisode);
  });
});

/**
 * Finds and tracks the currently-spoken transcript segment during playback.
 *
 * How it works (ELI10):
 * Imagine the transcript is a list of lines with timestamps.
 * As the audio plays, this hook figures out which line you're currently
 * listening to — like a karaoke display that highlights the current lyric.
 *
 * findSegmentIndex: a pure binary search function (no React, fully testable).
 * useCurrentSegment: a React hook that wires findSegmentIndex to the audio element.
 */

import { useState, useEffect } from 'react';
import type { TranscriptSegment } from '../types/transcript';

// ---------------------------------------------------------------------------
// Pure binary search — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Returns the index of the last segment whose `start` is <= t.
 * Returns -1 when the array is empty or t is before the first segment.
 *
 * Why binary search?
 * A typical episode has ~200-400 segments. Linear scan from index 0
 * every ~250 ms (timeupdate fires ~4 Hz) wastes CPU. Binary search
 * finds the answer in log2(400) ≈ 9 comparisons instead of up to 400.
 *
 * @param segments - Ordered (by `start`) array of transcript segments.
 * @param t        - Current audio time in seconds.
 */
export function findSegmentIndex(segments: TranscriptSegment[], t: number): number {
  // Empty array or before the first segment — nothing to highlight.
  if (segments.length === 0 || t < segments[0].start) return -1;

  let lo = 0;
  let hi = segments.length - 1;

  while (lo < hi) {
    // Use ceil for the midpoint so the loop always terminates:
    // when lo+1 == hi, mid = hi, and we either push lo up or hi down.
    const mid = Math.ceil((lo + hi) / 2);

    if (segments[mid].start <= t) {
      lo = mid; // mid could be the answer; keep looking right
    } else {
      hi = mid - 1; // mid is too far; exclude it
    }
  }

  // lo == hi: this is the last segment whose start is <= t.
  return lo;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Subscribes to audio timeupdate/seeked events and returns the index of the
 * currently active transcript segment (or -1 when none).
 *
 * @param audio    - The shared HTMLAudioElement from usePlayback().
 * @param segments - Ordered transcript segments (empty array when not loaded).
 * @param enabled  - Should be `open && playingEpisode?.num === episode.num`.
 *                   When false, returns -1 immediately and removes all listeners.
 */
export function useCurrentSegment(
  audio: HTMLAudioElement | undefined,
  segments: TranscriptSegment[],
  enabled: boolean
): number {
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    if (!enabled || !audio || segments.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset the highlight when sync is disabled; same justified pattern as [episodeNum]/index.tsx:203
      setIndex(-1);
      return;
    }

    const update = () => {
      const t = audio.currentTime;
      const i = findSegmentIndex(segments, t);
      // Only trigger a re-render when the segment actually changes.
      // Without this guard, every timeupdate (4 Hz) would re-render
      // the entire list even when the highlighted row hasn't changed.
      setIndex((prev) => (prev === i ? prev : i));
    };

    // Run immediately so the highlight is right on open.
    update();

    audio.addEventListener('timeupdate', update, { passive: true });
    audio.addEventListener('seeked', update, { passive: true });

    return () => {
      audio.removeEventListener('timeupdate', update);
      audio.removeEventListener('seeked', update);
    };
  }, [audio, segments, enabled]);

  return index;
}

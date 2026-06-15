/**
 * Finds and tracks the currently-spoken word within the active transcript segment.
 *
 * How it works (ELI10):
 * Once we know which line (segment) is playing, this hook zooms in further and
 * finds which individual word is being spoken right now — like a karaoke display
 * that highlights not just the current lyric line, but the exact word.
 *
 * Mirrors the pattern of useCurrentSegment, but operates on word-level timestamps
 * within a single segment rather than segment-level timestamps across the episode.
 */

import { useState, useEffect } from 'react';
import type { TranscriptSegment } from '../types/transcript';

/**
 * Subscribes to audio timeupdate/seeked events and returns the index of the
 * currently active word within the given segment (or -1 when none).
 *
 * @param audio       - The shared HTMLAudioElement from usePlayback().
 * @param segment     - The currently active TranscriptSegment (null when none).
 * @param syncEnabled - Should be the same condition used for useCurrentSegment.
 *                      When false, returns -1 immediately and removes all listeners.
 */
export function useCurrentWord(
  audio: HTMLAudioElement | null,
  segment: TranscriptSegment | null,
  syncEnabled: boolean,
): number {
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    if (!syncEnabled || !audio || !segment || !segment.words?.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset when sync disabled or no word data, same justified pattern as useCurrentSegment
      setIndex(-1);
      return;
    }

    const words = segment.words;

    const update = () => {
      const t = audio.currentTime;

      // Find the last word whose startSec <= currentTime.
      // Linear scan is fine here: segments have ~10 words on average.
      let active = -1;
      for (let i = 0; i < words.length; i++) {
        if (words[i][1] <= t) {
          active = i;
        } else {
          break;
        }
      }

      // Clamp: if we've gone past the last word's end, stay on the last word.
      if (active === -1 && words.length > 0 && t > words[words.length - 1][2]) {
        active = words.length - 1;
      }

      setIndex((prev) => (prev === active ? prev : active));
    };

    // Run immediately so the highlight is right when the active segment changes.
    update();

    audio.addEventListener('timeupdate', update, { passive: true });
    audio.addEventListener('seeked', update, { passive: true });

    return () => {
      audio.removeEventListener('timeupdate', update);
      audio.removeEventListener('seeked', update);
    };
  }, [audio, segment, syncEnabled]);

  return index;
}

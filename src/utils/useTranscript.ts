/**
 * Hooks for fetching episode transcripts from the static /transcripts/ directory.
 *
 * How it works:
 * - useTranscriptIndex() fetches /transcripts/manifest.json ONCE per browser session
 *   and returns a Set<string> of episode numbers that have transcripts.
 *   Think of it like a table of contents page.
 *
 * - useTranscript(num, enabled) lazily fetches /transcripts/{num}.json when
 *   `enabled` is true (i.e., when the user opens the overlay for that episode).
 *   Think of it like pulling the actual insert sheet out of the sleeve.
 *
 * Both hooks cache their results at module level (outside React) so that
 * navigating between episodes never re-fetches data you already have.
 *
 * The ?id=BUILD_ID query param busts browser/CDN caches after deploys
 * (same pattern as buildId.ts used elsewhere in this codebase).
 */

import { useState, useEffect, useCallback } from 'react';
import { withBuildId } from './buildId';
import type { Transcript } from '../types/transcript';

// ---------------------------------------------------------------------------
// Module-level promise caches — survive component unmount/remount
// ---------------------------------------------------------------------------

/** Cached promise for the manifest fetch (one per session). */
let manifestPromise: Promise<Set<string>> | null = null;

/** Cached promises for individual transcript fetches, keyed by episode num. */
const transcriptPromises = new Map<string, Promise<Transcript | null>>();

// ---------------------------------------------------------------------------
// useTranscriptIndex
// ---------------------------------------------------------------------------

type TranscriptIndexResult = {
  /** Set of episode numbers that have an available transcript. Null while loading. */
  index: Set<string> | null;
  /** True once the manifest fetch has settled (succeeded or failed). */
  ready: boolean;
};

/**
 * Fetches (and caches) /transcripts/manifest.json.
 * Returns a Set<string> of episode numbers with transcripts.
 * Fails closed: if the fetch fails, `index` stays null and `ready` becomes true.
 */
export function useTranscriptIndex(): TranscriptIndexResult {
  const [state, setState] = useState<TranscriptIndexResult>({
    index: null,
    ready: false,
  });

  useEffect(() => {
    // If we already have a cached promise, attach to it instead of re-fetching.
    // This is like checking your notes before making a phone call.
    if (!manifestPromise) {
      manifestPromise = fetch(withBuildId('/transcripts/manifest.json'))
        .then((res) => {
          if (!res.ok) throw new Error(`manifest fetch failed: ${res.status}`);
          return res.json();
        })
        .then((data: { episodes?: string[] }) => {
          return new Set<string>(data.episodes ?? []);
        })
        .catch((err) => {
          // Fail closed: the transcript UI simply stays hidden.
          console.warn('[useTranscriptIndex] Failed to load transcript manifest:', err);
          return new Set<string>();
        });
    }

    let cancelled = false;
    manifestPromise.then((index) => {
      if (!cancelled) {
        setState({ index, ready: true });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []); // Run once on mount — the module-level cache handles deduplication.

  return state;
}

// ---------------------------------------------------------------------------
// useTranscript
// ---------------------------------------------------------------------------

type TranscriptResult = {
  /** The loaded transcript, or null while loading / on error. */
  transcript: Transcript | null;
  /** True once the fetch has settled (whether it succeeded or failed). */
  ready: boolean;
  /** Error message if the fetch failed; null otherwise. */
  error: string | null;
  /** Clears the error state and re-fetches (the failed promise is evicted from cache). */
  retry: () => void;
};

/**
 * Lazily fetches /transcripts/{num}.json when `enabled` is true.
 * Uses a module-level promise cache so the JSON is only fetched once
 * even if the overlay is opened, closed, and reopened.
 *
 * @param num     - Episode number string (e.g. "84") matching Episode.num.
 * @param enabled - Set to true when the user opens the overlay. Prevents
 *                  fetching transcripts for episodes the user never views.
 */
export function useTranscript(
  num: string | undefined,
  enabled: boolean
): TranscriptResult {
  const [state, setState] = useState<Omit<TranscriptResult, 'retry'>>({
    transcript: null,
    ready: false,
    error: null,
  });
  // Bumped by retry() to re-run the fetch effect after a failure.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Don't fetch until the overlay is open and we have a valid episode num.
    if (!enabled || !num) return;

    // Check if we already have a cached promise for this episode.
    if (!transcriptPromises.has(num)) {
      const promise = fetch(withBuildId(`/transcripts/${num}.json`))
        .then((res) => {
          if (!res.ok) throw new Error(`transcript fetch failed: ${res.status}`);
          return res.json() as Promise<Transcript>;
        })
        .catch((err) => {
          console.warn(`[useTranscript] Failed to load transcript for episode ${num}:`, err);
          // Evict so a transient failure (network hiccup) can be retried;
          // only successful fetches stay cached for the session.
          transcriptPromises.delete(num);
          // Return null so the overlay shows the error state.
          return null;
        });
      transcriptPromises.set(num, promise);
    }

    let cancelled = false;
    transcriptPromises.get(num)!.then((transcript) => {
      if (!cancelled) {
        setState({
          transcript,
          ready: true,
          error: transcript === null ? 'Impossible de charger la transcription.' : null,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [num, enabled, attempt]);

  // Reset state when switching to a different episode so we don't briefly
  // show the previous episode's transcript before the new one loads.
  // (The cache will make the re-fetch instant if we've seen this num before.)
  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reset view state when the overlay closes; same justified pattern as [episodeNum]/index.tsx:203
      setState({ transcript: null, ready: false, error: null });
    }
  }, [num, enabled]);

  const retry = useCallback(() => {
    setState({ transcript: null, ready: false, error: null });
    setAttempt((a) => a + 1);
  }, []);

  return { ...state, retry };
}

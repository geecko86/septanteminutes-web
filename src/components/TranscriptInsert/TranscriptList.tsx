'use client';
/**
 * TranscriptList — the printed interview layout inside the insert overlay.
 *
 * Renders a scrollable list of transcript segments.
 * The active (currently-spoken) segment gets a gold marker highlight
 * and is kept in view via scrollIntoView when auto-follow is enabled.
 *
 * Performance notes:
 * - React.memo on SegmentRow prevents unnecessary re-renders — only the
 *   previously-active and newly-active rows re-render on each segment change.
 * - content-visibility: auto in CSS keeps off-screen rows cheap to paint.
 * - No virtualization needed for 200-400 rows with content-visibility.
 */

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import MaterialSpinningLoader from '../MaterialSpinningLoader/index.js';
import type { Transcript, TranscriptSegment } from '../../types/transcript';
import styles from './insert.module.css';

// ---------------------------------------------------------------------------
// Word highlighting helpers
// ---------------------------------------------------------------------------

/**
 * Splits a raw ASR word token into its displayable content and any trailing
 * punctuation that should fall outside the highlight chip.
 * Examples: "gens,"  → ["gens", ","]
 *           "m'entoure." → ["m'entoure", "."]
 *           "jamais" → ["jamais", ""]
 */
function splitTrailingPunct(text: string): [string, string] {
  const m = text.match(/^([\s\S]*?)([.,!?;:…—–]*)$/);
  return [m?.[1] ?? text, m?.[2] ?? ''];
}

// ---------------------------------------------------------------------------
// Time formatting helpers
// ---------------------------------------------------------------------------

/**
 * Formats a number of seconds as m:ss (under 1 hour) or h:mm:ss (1 hour+).
 * Examples: 65 → "1:05", 3725 → "1:02:05"
 */
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Ink stains — an absolute layer behind the text, scattered pseudo-randomly
// across the whole scroll content. The text itself "masks" the layer: every
// line fragment carries an opaque paper background (see .linePaper), so a
// stain under a sentence is knocked out along that line while staying
// visible in the gaps, margins and ragged line-ends around it.
// ---------------------------------------------------------------------------

const INK_SHAPES = [styles.inkA, styles.inkB, styles.inkC];

/** Cheap integer hash (Knuth multiplicative) — stable across renders/SSR. */
function inkHash(id: number): number {
  return Math.abs(Math.imul(id + 1, 2654435761)) >>> 0;
}

type InkSpot = {
  key: number;
  className: string;
  style: React.CSSProperties;
};

/**
 * Deterministic scatter: ~1 stain per 2 segments, positions drawn from the
 * hash — vertically spread over the full content height with jitter,
 * horizontally anywhere from margin to margin. Stable across renders.
 */
function buildInkSpots(segmentCount: number): InkSpot[] {
  // ≈0.83 stains per segment (the original 0.5 raised by 66%).
  const count = Math.ceil(segmentCount / 1.2);
  const spots: InkSpot[] = [];
  for (let i = 0; i < count; i++) {
    const h = inkHash(i * 7 + 3);
    const size = Math.round((7 + ((h >>> 7) % 8)) * 1.8); // 13-25px
    const rotate = -90 + ((h >>> 11) % 180);
    spots.push({
      key: i,
      className: `${styles.inkSpot} ${INK_SHAPES[(h >>> 3) % 3]}`,
      style: {
        // Even vertical spread with ±half-slot jitter; 1-97% horizontally.
        top: `${(((i + 0.1 + ((h >>> 17) % 80) / 100) / count) * 100).toFixed(3)}%`,
        left: `${1 + ((h >>> 5) % 9600) / 100}%`,
        width: size,
        height: size,
        transform: `rotate(${rotate}deg)`,
      },
    });
  }
  return spots;
}

// ---------------------------------------------------------------------------
// SegmentRow — single transcript line
// ---------------------------------------------------------------------------

type SegmentRowProps = {
  segment: TranscriptSegment;
  /** Display name for this segment's speaker (resolved from transcript.speakers). */
  speakerName: string;
  /** Whether to show the speaker byline (only on first segment per speaker turn). */
  showSpeaker: boolean;
  /** Whether this segment is currently being spoken (highlighted). */
  isActive: boolean;
  /** Index of the currently active word within this segment (-1 = none / row not active). */
  activeWordIndex: number;
  /** Callback when the user clicks the timestamp to seek. */
  onSeek: (time: number) => void;
};

/**
 * A single row in the transcript list.
 * Wrapped in React.memo so only changed rows re-render — all props are
 * scalars or stable references, and the parent locates the active row for
 * scrollIntoView via its data-segment-id attribute instead of a ref.
 */
const SegmentRow = React.memo(
  function SegmentRow({ segment, speakerName, showSpeaker, isActive, activeWordIndex, onSeek }: SegmentRowProps) {
    // Typewriter misregistration: ~half the rows shift by a hair (translate
    // only — sub-degree text rotation antialiases to mush). Deterministic
    // from the segment id, so memo-safe and stable across renders.
    const jitterHash = inkHash(segment.id * 3 + 1);
    const jitter =
      jitterHash % 10 < 5
        ? `translate(${(jitterHash >>> 4) % 2}px, ${(((jitterHash >>> 6) % 2) * 0.5).toFixed(1)}px)`
        : undefined;
    return (
      <li
        // aria-current signals to screen readers which segment is active.
        // We intentionally avoid aria-live here to prevent VoiceOver spam
        // every time the highlight advances during playback.
        aria-current={isActive ? 'true' : undefined}
        className={`${styles.segmentRow} ${isActive ? styles.segmentRowActive : ''}`}
        data-segment-id={segment.id}
      >
        {/* Timestamp button — click-to-seek */}
        <button
          className={styles.timestamp}
          onClick={() => onSeek(segment.start)}
          aria-label={`Écouter à ${formatTime(segment.start)}`}
          tabIndex={0}
          type="button"
        >
          {formatTime(segment.start)}
        </button>

        {/* Speaker byline — only when the speaker changes from the previous row */}
        {showSpeaker && (
          <strong className={styles.speaker}>{speakerName}</strong>
        )}

        {/* The spoken text — spans both rows when there's no speaker byline.
            align-self: baseline keeps its first line on the timestamp's
            baseline (the spanning item participates in row 1's baseline set).
            The .linePaper span gives each line fragment an opaque paper
            background that occludes the ink layer underneath. */}
        <p
          className={styles.segmentText}
          style={{
            transform: jitter,
            ...(showSpeaker ? undefined : { gridRow: '1 / span 2', alignSelf: 'baseline' }),
          }}
        >
          {isActive && segment.words?.length ? (
            // Word-by-word highlighting: trailing punctuation is split out so
            // the chip never covers a comma or period. The highlight uses only
            // box-shadow (no padding/margin changes) so advancing the word
            // index never triggers a layout reflow.
            <span className={styles.linePaper}>
              {segment.words.map((word, wi) => {
                const [content, punct] = splitTrailingPunct(word[0]);
                return (
                  <React.Fragment key={wi}>
                    {wi === activeWordIndex && content
                      ? <span className={styles.wordActive}>{content}</span>
                      : content}
                    {punct}{' '}
                  </React.Fragment>
                );
              })}
            </span>
          ) : (
            <span className={styles.linePaper}>{segment.text}</span>
          )}
        </p>
      </li>
    );
  }
);

// ---------------------------------------------------------------------------
// TranscriptList
// ---------------------------------------------------------------------------

type TranscriptListProps = {
  transcript: Transcript | null;
  /** True while fetching, false once settled. */
  loading: boolean;
  /** Error message if the fetch failed. */
  error: string | null;
  /** Index of the currently active segment (-1 = none). */
  activeIndex: number;
  /** Index of the currently active word within the active segment (-1 = none). */
  activeWordIndex: number;
  /** Whether auto-follow (scroll to active) is enabled. */
  following: boolean;
  /** Called when the user clicks a timestamp button. */
  onSeek: (time: number) => void;
  /** Called when the user manually scrolls (suspends auto-follow). */
  onUserScroll: () => void;
  /** Called when user clicks "Reprendre le suivi". */
  onResumeFollow: () => void;
  /** Called when the user clicks "Réessayer" after a failed fetch. */
  onRetry: () => void;
  /** Whether a transcript-enabled episode is currently playing. */
  syncEnabled: boolean;
};

export default function TranscriptList({
  transcript,
  loading,
  error,
  activeIndex,
  activeWordIndex,
  following,
  onSeek,
  onUserScroll,
  onResumeFollow,
  onRetry,
  syncEnabled,
}: TranscriptListProps) {
  const prefersReducedMotion = useReducedMotion();

  // Scattered ink stains for the absolute layer — recomputed only when the
  // transcript changes (deterministic, so the scatter is stable per episode).
  const inkSpots = useMemo(
    () => buildInkSpots(transcript?.segments.length ?? 0),
    [transcript]
  );

  // Track the last index we scrolled to, so we don't call scrollIntoView
  // repeatedly for the same segment (it fires on every timeupdate otherwise).
  const lastScrolledIndex = useRef(-1);

  // The scrollable body div — we attach intent-detection listeners to it.
  const bodyRef = useRef<HTMLDivElement>(null);

  // Detect user *intent* to scroll (wheel, touch-move, arrow keys).
  // We deliberately avoid the 'scroll' event because our own programmatic
  // smooth scrolling would falsely trigger it and suspend auto-follow.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;

    const onWheel = () => onUserScroll();
    const onTouchMove = () => onUserScroll();
    const onKeyDown = (e: KeyboardEvent) => {
      // Up/Down arrows, Page Up/Down are scroll-intent keys.
      if ([38, 40, 33, 34].includes(e.keyCode)) onUserScroll();
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('keydown', onKeyDown);

    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, [onUserScroll]);

  // While follow is suspended, forget the last scrolled position so that
  // "Reprendre le suivi" re-centres immediately instead of waiting for the
  // next segment transition.
  useEffect(() => {
    if (!following) lastScrolledIndex.current = -1;
  }, [following]);

  // While follow is suspended, watch the active line's *actual* visibility.
  // This drives BOTH the pill and the auto-resume. Gating the pill on real
  // off-screen-ness (not merely !following) is what makes it appear reliably:
  // a slow scroll that suspends follow but keeps the line in view shows no
  // pill; the moment the line leaves view the pill appears, at any scroll speed.
  const [activeOffscreen, setActiveOffscreen] = useState(false);
  // True once the active line has gone off-screen during the current
  // suspension — guards auto-resume so the observer's initial in-view reading
  // can't cancel the suspension the instant the user starts scrolling.
  const wasOffscreenRef = useRef(false);

  useEffect(() => {
    if (following || activeIndex < 0) {
      // No setState here (the pill is gated on !following, so the value is
      // moot while following is on); the observer below re-reads the real
      // visibility the moment follow suspends. Just clear the resume guard.
      wasOffscreenRef.current = false;
      return;
    }
    const segmentId = transcript?.segments[activeIndex]?.id;
    const root = bodyRef.current;
    if (segmentId === undefined || !root) return;
    const el = root.querySelector(`li[data-segment-id="${segmentId}"]`);
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const ratio = entries[entries.length - 1].intersectionRatio;
        const offscreen = ratio < 0.5;
        setActiveOffscreen(offscreen);
        if (offscreen) {
          wasOffscreenRef.current = true;
        } else if (ratio >= 0.85 && wasOffscreenRef.current) {
          // The line returned to view after the user had scrolled away (or
          // playback caught up to where they're reading) — resume auto-follow.
          onResumeFollow();
        }
      },
      { root, threshold: [0, 0.5, 0.85, 1] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [following, activeIndex, transcript, onResumeFollow]);

  // Auto-scroll when activeIndex changes and following is on.
  // The active row is located by its data-segment-id attribute — no per-row
  // refs, so SegmentRow's React.memo props stay stable across renders.
  useEffect(() => {
    if (!following || activeIndex < 0 || activeIndex === lastScrolledIndex.current) return;
    const segmentId = transcript?.segments[activeIndex]?.id;
    if (segmentId === undefined) return;
    const el = bodyRef.current?.querySelector(`li[data-segment-id="${segmentId}"]`);
    if (el) {
      lastScrolledIndex.current = activeIndex;
      el.scrollIntoView({
        block: 'center',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  }, [activeIndex, following, prefersReducedMotion, transcript]);

  // ---- Loading state ----
  if (loading) {
    return (
      <div className={styles.loadingState}>
        <MaterialSpinningLoader />
        <span>Chargement de la transcription…</span>
      </div>
    );
  }

  // ---- Error state ----
  if (error || !transcript) {
    return (
      <div className={styles.errorState}>
        <span>{error ?? 'Impossible de charger la transcription.'}</span>
        <button
          className={styles.retryButton}
          type="button"
          onClick={onRetry}
        >
          Réessayer
        </button>
      </div>
    );
  }

  const { segments, speakers } = transcript;

  return (
    <>
      {/* Scrollable list body */}
      <div
        ref={bodyRef}
        className={styles.body}
        tabIndex={0}
        role="region"
        aria-label="Transcription de l'épisode"
      >
        {/* position:relative wrapper spanning the full scroll content — the
            ink layer fills it absolutely and therefore scrolls natively. */}
        <div className={styles.scrollContent}>
          <div className={styles.inkLayer} aria-hidden="true">
            {inkSpots.map((spot) => (
              <span key={spot.key} className={spot.className} style={spot.style} />
            ))}
          </div>
          <ol className={styles.list} aria-live="off">
            {segments.map((seg, i) => {
              const prevSpeaker = i > 0 ? segments[i - 1].speaker : null;
              const showSpeaker = seg.speaker !== prevSpeaker;
              const speakerName = speakers[seg.speaker] ?? seg.speaker;

              return (
                <SegmentRow
                  key={seg.id}
                  segment={seg}
                  speakerName={speakerName}
                  showSpeaker={showSpeaker}
                  isActive={i === activeIndex}
                  activeWordIndex={i === activeIndex ? activeWordIndex : -1}
                  onSeek={onSeek}
                />
              );
            })}
          </ol>
        </div>
      </div>

      {/* "Reprendre le suivi" pill — shown when playback is active but following paused */}
      <AnimatePresence>
        {syncEnabled && !following && activeOffscreen && (
          <motion.button
            key="follow-pill"
            className={styles.followPill}
            // The paper scrap's slight tilt lives in the motion targets:
            // Framer owns this element's transform (it animates y).
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8, rotate: -0.7 }}
            animate={{ opacity: 1, y: 0, rotate: -0.7 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 8, rotate: -0.7 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { type: 'spring', stiffness: 300, damping: 30 }
            }
            onClick={onResumeFollow}
            type="button"
          >
            Reprendre le suivi
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}

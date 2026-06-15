'use client';
/**
 * TranscriptInsert — the lyrics-insert overlay for podcast transcripts.
 *
 * Think of it like pulling a printed lyric sheet out of an LP sleeve:
 * it slides out into a readable paper panel where you can follow along
 * with the interview in real time, or click timestamps to jump to a moment.
 *
 * Desktop: centred paper panel with a slight tilt.
 * Mobile:  bottom sheet with a grab handle for drag-to-dismiss.
 *
 * Key a11y points:
 * - Root is <div role="dialog"> — this re-enables ::selection text selection
 *   (see _app.tsx:205-213 which suppresses it outside dialogs).
 * - FloatingFocusManager traps focus and restores it on close.
 * - Escape key and backdrop click both dismiss.
 * - No aria-live on the moving highlight (just aria-current) to avoid VoiceOver spam.
 */

import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import {
  useFloating,
  useDismiss,
  useInteractions,
  FloatingPortal,
  FloatingOverlay,
  FloatingFocusManager,
} from '@floating-ui/react';
import {
  motion,
  animate,
  AnimatePresence,
  useReducedMotion,
  useDragControls,
  useMotionValue,
  useMotionTemplate,
} from 'framer-motion';

import { usePlayback, hackAutoplay } from '../../utils/PlayerContext';
import { useTranscript } from '../../utils/useTranscript';
import { useCurrentSegment } from '../../utils/useCurrentSegment';
import { useCurrentWord } from '../../utils/useCurrentWord';
import { getGuestName, getEpisodeTopic } from '../../utils/episodeTitle';
import type { Episode } from '../../types/episode';
import TranscriptList from './TranscriptList';
import styles from './insert.module.css';

// ---------------------------------------------------------------------------
// Spring config — shared with the page's other Framer animations
// ---------------------------------------------------------------------------
const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const;

// The notebook overlay's motion family (src/anim/notebook.js) — the pull-out
// morph and the scrim use these so both overlays feel like the same hand.
const NOTEBOOK_EASE_IN: [number, number, number, number] = [0.5, 0, 0.88, 0.77];
const NOTEBOOK_EASE_OUT: [number, number, number, number] = [0.12, 0.23, 0.5, 1];
const MORPH_SPRING = { type: 'spring', stiffness: 400, damping: 30, mass: 1 } as const;

// ---------------------------------------------------------------------------
// PlaybackChip — printed play/pause + elapsed time for the mobile sheet
// (the floating playbar does not exist on touch devices). Isolated component:
// its ~4 Hz timeupdate re-render never touches the transcript list.
// ---------------------------------------------------------------------------
function formatChipTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function PlaybackChip() {
  const { audio, isPlaying, setPlaying } = usePlayback();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!audio) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: sync the displayed time to the current playback position on mount
    setElapsed(audio.currentTime);
    const update = () => setElapsed(audio.currentTime);
    audio.addEventListener('timeupdate', update, { passive: true });
    return () => audio.removeEventListener('timeupdate', update);
  }, [audio]);

  return (
    <button
      className={styles.playbackChip}
      type="button"
      onClick={() => setPlaying(!isPlaying)}
      aria-label={isPlaying ? 'Mettre en pause' : 'Reprendre la lecture'}
    >
      <span aria-hidden="true">{isPlaying ? '❚❚' : '▶'}</span>
      <span>{formatChipTime(elapsed)}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type TranscriptInsertProps = {
  open: boolean;
  onDismiss: () => void;
  /** The episode currently shown in the description column. */
  episode: Episode;
  isMobileDevice: boolean;
  isIOSDevice: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TranscriptInsert({
  open,
  onDismiss,
  episode,
  isMobileDevice,
  isIOSDevice,
}: TranscriptInsertProps) {
  const titleId = useId();
  const prefersReducedMotion = useReducedMotion();

  // -- Playback context ----
  const { audio, playingEpisode, setPlayingEpisode, setPlaying } = usePlayback();

  // Flag the open overlay on <body> so the floating playbar can lift itself
  // above our backdrop (see controls.module.css) and stay reachable.
  // Set immediately on open, but NOT removed here on close: the backdrop
  // stays mounted through the exit fade, and dropping the playbar's z-index
  // right away would let the dying backdrop cover it for a split second.
  // Removal happens in AnimatePresence's onExitComplete below.
  useEffect(() => {
    if (open) document.body.dataset.transcriptOpen = 'true';
  }, [open]);

  // Safety net: clear the flag if the overlay unmounts entirely.
  useEffect(() => {
    return () => {
      delete document.body.dataset.transcriptOpen;
    };
  }, []);

  // -- Transcript data ----
  // Only fetch when the overlay is open — the hook handles the lazy/cached fetch.
  const { transcript, ready: transcriptReady, error: transcriptError, retry } = useTranscript(
    episode.num,
    open
  );

  // -- Sync state ----
  // "following" = auto-scroll to keep the active segment centred.
  const [following, setFollowing] = useState(true);

  // This episode's audio is currently playing in this overlay
  // (string compare because Episode.num is a string, e.g. "84").
  const syncEnabled = open && playingEpisode?.num === episode.num;

  const activeIndex = useCurrentSegment(
    audio,
    transcript?.segments ?? [],
    syncEnabled
  );

  const activeWordIndex = useCurrentWord(
    audio ?? null,
    transcript?.segments[activeIndex] ?? null,
    syncEnabled
  );

  // Pending seek ref: used for cold-start seek when no audio is loaded yet.
  // Pattern mirrors [episodeNum]/index.tsx:467-472.
  const pendingSeekRef = useRef<number | null>(null);

  // -- Pull-out morph (desktop only) ----
  // The sheet animates out of the album pile (the peek's viewport rect) and
  // back into it on dismiss. Driven by motion values set pre-paint, so the
  // first frame already sits on the pile.
  const morphEnabled = !isMobileDevice && !prefersReducedMotion;
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const isClosingRef = useRef(false);
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const mvScaleX = useMotionValue(1);
  const mvScaleY = useMotionValue(1);
  const mvRotate = useMotionValue(-0.5);
  const contentOpacity = useMotionValue(1);
  // Occlusion clip: a growing top-inset makes the sheet visually slide UNDER
  // the album stack (the portal paints above the sleeves, so without this the
  // morph ends as a whole sheet lying ON TOP of the pile). Applied
  // pre-transform, so it scales with the morph.
  const mvClipPct = useMotionValue(0);
  const sheetClipPath = useMotionTemplate`inset(${mvClipPct}% 0% 0% 0%)`;
  // Backdrop driven manually in morph mode so it fades in/out IN PARALLEL
  // with the pull-out instead of sequentially after it.
  const mvBackdrop = useMotionValue(0);
  // Whole-sheet opacity: crossfades the morphing sheet onto/off the real
  // (labeled) peek behind it at the morph endpoints — without it, the blank
  // strip covers the « TRANSCRIPTION » label until an abrupt unmount.
  const mvSheetOpacity = useMotionValue(1);

  /** Viewport geometry of the peek + how much of it hides under the sleeves. */
  const measureMorphGeometry = useCallback(() => {
    const peekEl = document.querySelector('[data-insert-peek]');
    const peekRect = peekEl?.getBoundingClientRect();
    if (!peekEl || !peekRect || peekRect.height === 0) return null;
    const albumsRect = peekEl.parentElement?.getBoundingClientRect();
    const hidden = albumsRect
      ? Math.min(0.9, Math.max(0, (albumsRect.bottom - peekRect.top) / peekRect.height))
      : 0;
    return { peekRect, hiddenPct: hidden * 100 };
  }, []);

  // useDismiss needs a close handler before handleDismiss can exist (it needs
  // the floating context) — bridged through a ref, assigned below.
  const closeRef = useRef<() => void>(() => onDismiss());

  // -- Floating-UI setup ----
  const { refs, context } = useFloating({
    open,
    onOpenChange: (nextOpen) => {
      if (!nextOpen) closeRef.current();
    },
  });
  const dismiss = useDismiss(context, {
    // The lifted playbar paints above the backdrop while we're open — clicks
    // on it must operate the player, not dismiss the transcript.
    outsidePress: (event) =>
      !(event.target instanceof Element && event.target.closest('#floating-playback-controls')),
  });
  const { getFloatingProps } = useInteractions([dismiss]);

  // -- Mobile drag-to-dismiss ----
  const dragControls = useDragControls();

  // Entry morph: start the sheet AT the pile, then spring it into reading
  // position. Invoked from the sheet's CALLBACK REF (not an effect keyed on
  // `open`): on a first-ever open, FloatingPortal creates its host node in
  // its own effect, so the sheet isn't in the DOM yet when our effects run —
  // the ref fires exactly when the element attaches, portal or not, still
  // pre-paint.
  const entryStartedRef = useRef(false);

  const startEntryMorph = useCallback((sheetEl: HTMLDivElement) => {
    isClosingRef.current = false;

    // Neutralize FIRST: a previous close-morph leaves the motion values at
    // the tucked-into-the-pile state (tiny scale, displaced, content hidden).
    // Without this, re-measurement is corrupted by the stale transform and
    // any early bail leaves the sheet invisible on reopen.
    for (const mv of [mvX, mvY, mvScaleX, mvScaleY, mvRotate, contentOpacity, mvClipPct, mvBackdrop, mvSheetOpacity]) {
      mv.stop();
    }
    mvX.set(0);
    mvY.set(0);
    mvScaleX.set(1);
    mvScaleY.set(1);
    mvRotate.set(-0.5);
    contentOpacity.set(1);
    mvClipPct.set(0);
    mvSheetOpacity.set(1);
    mvBackdrop.set(0);
    animate(mvBackdrop, 1, { duration: 0.3, ease: NOTEBOOK_EASE_IN });

    // MV→style flushes are batched, so the inline transform may still be the
    // stale one here: measure the laid-out geometry with transform cleared.
    const previousTransform = sheetEl.style.transform;
    sheetEl.style.transform = 'none';
    const sheetRect = sheetEl.getBoundingClientRect();
    sheetEl.style.transform = previousTransform;

    const geometry = measureMorphGeometry();

    if (geometry) {
      const { peekRect, hiddenPct } = geometry;
      mvX.set(peekRect.left + peekRect.width / 2 - (sheetRect.left + sheetRect.width / 2));
      mvY.set(peekRect.top + peekRect.height / 2 - (sheetRect.top + sheetRect.height / 2));
      mvScaleX.set(peekRect.width / sheetRect.width);
      mvScaleY.set(peekRect.height / sheetRect.height);
      mvRotate.set(-1.7);
      // First frame: only the strip below the pile shows — identical to the
      // resting peek. The clip springs open as the sheet pulls out, and the
      // sheet materializes over the labeled peek (no label blink).
      mvClipPct.set(hiddenPct);
      mvSheetOpacity.set(0);
      animate(mvSheetOpacity, 1, { duration: 0.12, ease: NOTEBOOK_EASE_IN });
    } else {
      // No peek on screen (shouldn't happen on entry) — gentle rise fallback.
      mvX.set(0);
      mvY.set(24);
      mvScaleX.set(1);
      mvScaleY.set(1);
      mvRotate.set(-0.5);
    }
    contentOpacity.set(0);

    animate(mvX, 0, MORPH_SPRING);
    animate(mvY, 0, MORPH_SPRING);
    animate(mvScaleX, 1, MORPH_SPRING);
    animate(mvScaleY, 1, MORPH_SPRING);
    animate(mvRotate, -0.5, MORPH_SPRING);
    animate(mvClipPct, 0, MORPH_SPRING);
    // Text fades in once the sheet is mostly unfolded — squashed type never reads.
    animate(contentOpacity, 1, { duration: 0.3, delay: 0.12, ease: NOTEBOOK_EASE_IN });
  }, [measureMorphGeometry, mvX, mvY, mvScaleX, mvScaleY, mvRotate, contentOpacity, mvClipPct, mvBackdrop, mvSheetOpacity]);

  // Re-arm the entry morph for the next open.
  useEffect(() => {
    if (!open) entryStartedRef.current = false;
  }, [open]);

  // -- Handlers ----

  const handleDismiss = useCallback(() => {
    if (isClosingRef.current) return;
    const finish = () => {
      setFollowing(true); // reset follow state when closed
      onDismiss();
    };

    if (!morphEnabled) {
      finish();
      return;
    }

    // Reverse morph: spring the sheet back UNDER the pile, then unmount.
    const sheetRect = sheetRef.current?.getBoundingClientRect();
    const geometry = measureMorphGeometry();
    if (!sheetRect || !geometry) {
      finish(); // peek gone (episode changed) — plain fade fallback
      return;
    }
    const { peekRect, hiddenPct } = geometry;
    isClosingRef.current = true;

    Promise.all([
      animate(mvX, peekRect.left + peekRect.width / 2 - (sheetRect.left + sheetRect.width / 2), MORPH_SPRING),
      animate(mvY, peekRect.top + peekRect.height / 2 - (sheetRect.top + sheetRect.height / 2), MORPH_SPRING),
      animate(mvScaleX, peekRect.width / sheetRect.width, MORPH_SPRING),
      animate(mvScaleY, peekRect.height / sheetRect.height, MORPH_SPRING),
      animate(mvRotate, -1.7, MORPH_SPRING),
      // The top of the sheet disappears under the sleeves as it approaches —
      // the end state is pixel-identical to the resting peek.
      animate(mvClipPct, hiddenPct, MORPH_SPRING),
      animate(contentOpacity, 0, { duration: 0.18, ease: NOTEBOOK_EASE_OUT }),
      // The room lights back up WHILE the sheet slides home, not after.
      animate(mvBackdrop, 0, { duration: 0.45, ease: NOTEBOOK_EASE_OUT }),
      // Dissolve onto the labeled peek as the springs settle: the strip
      // crossfades into the real peek instead of masking it until unmount.
      animate(mvSheetOpacity, 0, { duration: 0.3, delay: 0.2, ease: NOTEBOOK_EASE_OUT }),
    ]).then(finish);
  }, [morphEnabled, onDismiss, measureMorphGeometry, mvX, mvY, mvScaleX, mvScaleY, mvRotate, contentOpacity, mvClipPct, mvBackdrop, mvSheetOpacity]);

  // Keep the dismiss bridge pointing at the latest morph-aware handler.
  useEffect(() => {
    closeRef.current = handleDismiss;
  }, [handleDismiss]);

  /**
   * Click-to-seek logic:
   * - If this episode is already loaded in the audio element → seek directly.
   * - Cold start (nothing playing or different episode) → store the pending
   *   seek time and trigger loading; a one-shot loadedmetadata listener
   *   applies the seek once the audio is ready.
   *
   * Why loadedmetadata instead of canplay?
   * canplay fires after buffering begins; loadedmetadata fires as soon as
   * the duration is known — we need duration before we can set currentTime
   * on some browsers.
   */
  /* eslint-disable react-hooks/immutability -- intentional: audio is the shared HTMLAudioElement from PlayerContext; setting currentTime inside an event handler is the supported seek API, same pattern as [episodeNum]/index.tsx */
  const handleSeek = useCallback(
    (time: number) => {
      if (!audio) return;

      // Same episode already in the player — seek directly.
      if (playingEpisode?.mp3 === episode.mp3 && audio.src === episode.mp3) {
        audio.currentTime = time;
        setPlaying(true);
        return;
      }

      // Cold start: store the pending time; start loading the episode.
      pendingSeekRef.current = time;

      const applyPendingSeek = () => {
        // Guard: skip if the audio src changed out from under us
        // (e.g. user navigated away and triggered a different episode).
        if (audio.src !== episode.mp3) return;
        const t = pendingSeekRef.current;
        if (t !== null) {
          audio.currentTime = t;
          pendingSeekRef.current = null;
        }
      };

      const load = () => {
        // Attach inside load(): on iOS, hackAutoplay's data-URI src fires its own
        // loadedmetadata, which would consume a { once: true } listener registered
        // earlier and leave the real episode's metadata event unhandled.
        audio.addEventListener('loadedmetadata', applyPendingSeek, { once: true });
        setPlaying(false);
        setPlayingEpisode(episode);
      };

      // iOS requires hackAutoplay when audio.src is empty (no silent base64 yet loaded).
      if (audio.src || !isIOSDevice) {
        load();
      } else {
        hackAutoplay(audio).then(load);
      }
    },
    [audio, episode, playingEpisode, setPlaying, setPlayingEpisode, isIOSDevice]
  );
  /* eslint-enable react-hooks/immutability */

  const handleUserScroll = useCallback(() => setFollowing(false), []);
  const handleResumeFollow = useCallback(() => setFollowing(true), []);

  // Reset follow on open so it's always tracking from the start.
  // We use a ref to detect the transition from closed→open.
  const wasOpen = useRef(false);
  /* eslint-disable react-hooks/refs -- intentional: closed→open transition detection during render, same pattern as [episodeNum]/index.tsx:127 */
  if (open && !wasOpen.current) {
    setFollowing(true);
    wasOpen.current = true;
  } else if (!open) {
    wasOpen.current = false;
  }
  /* eslint-enable react-hooks/refs */

  // -- Animations ----

  // Desktop: panel rises from below like an insert sliding out of the sleeve.
  // Mobile: bottom sheet slides up from the bottom edge.
  const sheetVariants = isMobileDevice
    ? {
        initial: { y: '100%', opacity: 1 },
        animate: { y: 0, opacity: 1 },
        exit: { y: '100%', opacity: 1 },
      }
    : {
        initial: { y: '30%', opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: '20%', opacity: 0 },
      };

  const transition = prefersReducedMotion
    ? { duration: 0.01 }
    : SPRING;

  // -- Episode metadata ----
  const episodeNum = episode.num;
  const guestName = getGuestName(episode.title);
  const topic = getEpisodeTopic(episode.title);
  // Archival header line: date (from the feed) + duration (from the loaded
  // transcript's last cue — appears once the JSON arrives).
  const episodeDateLabel = (() => {
    const d = new Date(episode.date);
    if (Number.isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  })();
  const lastSegment = transcript?.segments[transcript.segments.length - 1];
  const durationMinutes = lastSegment ? Math.round(lastSegment.end / 60) : null;

  // -- Rendered panel content ----
  // Shared between desktop and mobile layouts.
  const panelContent = (
    <>
      {/* Grab handle — mobile only, starts the drag gesture */}
      {isMobileDevice && (
        <div
          className={styles.grabHandle}
          onPointerDown={(e) => dragControls.start(e)}
          aria-hidden="true"
        />
      )}

      {/* Printed header */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.headerLabel}>
              Septante Minutes Avec N°{episodeNum}
              {episodeDateLabel && ` · ${episodeDateLabel}`}
              {durationMinutes !== null && ` · ${durationMinutes} min`}
            </p>
            <h2 id={titleId} className={styles.headerTitle}>
              {guestName}
            </h2>
            {topic && (
              <p className={styles.headerSubtitle}>{topic}</p>
            )}
          </div>
          <div className={styles.headerActions}>
            {isMobileDevice && playingEpisode?.num === episode.num && <PlaybackChip />}
            {/* Download of the hosted transcript file (the same VTT the
                podcast apps receive via the RSS feed) */}
            {!isMobileDevice && (
              <a
                className={styles.downloadButton}
                href={`/transcripts/${episode.num}.vtt`}
                download={`septante-minutes-${episode.num}-transcription.vtt`}
                aria-label="Télécharger la transcription"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/download_press.svg" alt="" draggable={false} width={44} height={44} />
              </a>
            )}
          </div>
        </div>
        {/* A literally typed rule instead of a CSS border */}
        <div aria-hidden="true" className={styles.typedRule}>
          {'-'.repeat(120)}
        </div>
      </div>

      {/* Transcript list — or loading/error states */}
      <TranscriptList
        transcript={transcript}
        loading={open && !transcriptReady}
        error={transcriptError}
        activeIndex={activeIndex}
        activeWordIndex={activeWordIndex}
        following={following}
        onSeek={handleSeek}
        onUserScroll={handleUserScroll}
        onResumeFollow={handleResumeFollow}
        onRetry={retry}
        syncEnabled={syncEnabled}
      />

      {/* Tear-off perforation divider above the colophon (its own element so
          the footer's soft-print text blur keeps the holes crisp). */}
      <div aria-hidden="true" className={styles.tearLine} />

      {/* Printed colophon footer */}
      <footer className={styles.footer}>
        Transcription générée automatiquement — des erreurs sont possibles.
      </footer>
    </>
  );

  return (
    <AnimatePresence
      onExitComplete={() => {
        // The backdrop is gone now — safe to drop the playbar back down.
        // Guard against a reopen racing the previous exit animation.
        if (!open) delete document.body.dataset.transcriptOpen;
      }}
    >
      {open && (
        <FloatingPortal>
          {/* FloatingOverlay: covers the whole screen and locks scroll. The
              scrim itself is a separate motion layer so it can fade out with
              the exit animation instead of popping away on unmount. */}
          <FloatingOverlay lockScroll className={styles.backdrop}>
            <motion.div
              className={styles.backdropFill}
              aria-hidden="true"
              {...(morphEnabled
                ? // Morph mode: the scrim is driven by mvBackdrop so it fades
                  // in/out IN PARALLEL with the pull-out morph.
                  {}
                : {
                    initial: { opacity: 0 },
                    animate: {
                      opacity: 1,
                      transition: prefersReducedMotion
                        ? { duration: 0.01 }
                        : { duration: 0.3, ease: NOTEBOOK_EASE_IN },
                    },
                    exit: {
                      opacity: 0,
                      transition: prefersReducedMotion
                        ? { duration: 0.01 }
                        : { duration: 0.45, ease: NOTEBOOK_EASE_OUT },
                    },
                  })}
              style={morphEnabled ? { opacity: mvBackdrop } : undefined}
            />
            {/* FloatingFocusManager: restores focus on close. Modal (focus trap)
                only on mobile — on desktop the lifted playbar must stay
                keyboard-reachable, so Tab may leave the dialog. */}
            <FloatingFocusManager context={context} initialFocus={0} modal={isMobileDevice}>
              {/* The root element MUST be div[role="dialog"] so _app.tsx's
                  ::selection suppression doesn't apply inside it. */}
              <motion.div
                ref={(node: HTMLDivElement | null) => {
                  refs.setFloating(node);
                  sheetRef.current = node;
                  // Fire the entry morph the moment the element attaches
                  // (pre-paint) — see startEntryMorph for why an effect
                  // keyed on `open` misses the first-ever open.
                  if (node && open && morphEnabled && !entryStartedRef.current) {
                    entryStartedRef.current = true;
                    startEntryMorph(node);
                  }
                }}
                role="dialog"
                aria-modal={isMobileDevice ? 'true' : undefined}
                aria-labelledby={titleId}
                className={isMobileDevice ? styles.sheetMobile : styles.sheetDesktop}
                {...(isMobileDevice
                  ? {
                      drag: 'y',
                      dragControls,
                      dragListener: false, // only drag from the handle
                      dragConstraints: { top: 0 },
                      dragElastic: 0.1,
                      onDragEnd: (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
                        if (info.offset.y > 100 || info.velocity.y > 500) handleDismiss();
                      },
                    }
                  : {})}
                {...(morphEnabled
                  ? // Pull-out morph drives everything via motion values — by
                    // the time we unmount, mvSheetOpacity has already
                    // dissolved the sheet onto the real peek, so no exit
                    // animation is needed (or wanted: it would re-pop).
                    {}
                  : { ...sheetVariants, transition })}
                style={
                  morphEnabled
                    ? {
                        x: mvX,
                        y: mvY,
                        scaleX: mvScaleX,
                        scaleY: mvScaleY,
                        rotate: mvRotate,
                        clipPath: sheetClipPath,
                        opacity: mvSheetOpacity,
                      }
                    : undefined
                }
                {...getFloatingProps()}
              >
                {/* Inner wrapper carries the content fade during the morph
                    (display:contents can't take opacity); replicates the
                    sheet's column layout so children lay out identically. */}
                <motion.div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    flex: 1,
                    minHeight: 0,
                    opacity: morphEnabled ? contentOpacity : 1,
                  }}
                >
                  {panelContent}
                </motion.div>
              </motion.div>
            </FloatingFocusManager>
          </FloatingOverlay>
        </FloatingPortal>
      )}
    </AnimatePresence>
  );
}

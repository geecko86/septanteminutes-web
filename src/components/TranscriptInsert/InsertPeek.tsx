'use client';
/**
 * InsertPeek — an opaque paper sheet sitting at the BOTTOM of the album pile.
 *
 * This is the entry point to the transcript overlay. It reads as a printed
 * insert tucked under the stack of sleeves on the desk: the sheet's upper
 * part is occluded by the vinyl sleeves (it renders as the FIRST child of
 * .albums at z-index 0, so the later-DOM sleeves paint over it) and only a
 * labelled bottom strip sticks out below the pile.
 *
 * Visual design:
 * - Opaque paper (CSS placeholder; a photographic insert_peek.png can replace
 *   the background later) with edge shadows — no transparency.
 * - On hover/focus it slides slightly further OUT of the pile (downwards).
 * - Wrapped in AnimatePresence so it fades in/out as the selected episode
 *   changes between one with a transcript and one without.
 */

import React from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import styles from './insert.module.css';

// ---------------------------------------------------------------------------
// Spring matching the notebook wobble
// ---------------------------------------------------------------------------
const SPRING = { type: 'spring', stiffness: 300, damping: 30 } as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type InsertPeekProps = {
  /** Whether the currently-selected episode has an available transcript. */
  transcriptAvailable: boolean;
  /** Whether the page is considered "ready" (images loaded, scene visible). */
  ready: boolean;
  /** Called when the user clicks/taps the peek button to open the overlay. */
  onOpen: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InsertPeek({ transcriptAvailable, ready, onOpen }: InsertPeekProps) {
  const prefersReducedMotion = useReducedMotion();
  const show = transcriptAvailable && ready;

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          key="insert-peek"
          className={styles.peek}
          // The overlay measures this element to animate the sheet out of /
          // back into the pile (viewport-space rects — robust inside the
          // transformed desk scene).
          data-insert-peek="true"
          // Fade in/out as episode switches between with-transcript and without.
          // The slight base tilt (an imperfect, hand-placed sheet) lives in the
          // motion targets because Framer owns this element's transform.
          initial={{ opacity: 0, rotate: -1.7 }}
          animate={{ opacity: 1, rotate: -1.7 }}
          exit={{ opacity: 0, rotate: -1.7 }}
          transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.3 }}
          // Hover/focus: slide slightly further OUT of the pile (downwards).
          whileHover={prefersReducedMotion ? {} : { y: 6, rotate: -1.7, transition: SPRING }}
          whileFocus={prefersReducedMotion ? {} : { y: 6, rotate: -1.7, transition: SPRING }}
          onClick={(e) => {
            // The peek lives inside the .albums div, whose own onClick starts
            // playback (or opens the service sheet on mobile) — don't bubble.
            e.stopPropagation();
            onOpen();
          }}
          type="button"
          aria-label="Lire la transcription"
          aria-haspopup="dialog"
        >
          {/* Under-sheets: two staggered papers behind the main face — the
              peek reads as a small stack, not a single flat rectangle. */}
          <span aria-hidden="true" className={styles.peekSheetC} />
          <span aria-hidden="true" className={styles.peekSheetB} />
          <span aria-hidden="true" className={styles.peekFace} />
          <span className={styles.peekLabel}>Transcription</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

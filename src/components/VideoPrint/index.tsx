import React from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";

import { getYoutubeFrameUrl } from "@/utils/youtubeLink";

import styles from "./videoprint.module.css";

/**
 * VideoPrint — a glossy photo lab print tucked UNDER the camera prop on the
 * table, shown only for episodes that have a filmed (YouTube) version.
 *
 * The print shows a REAL frame from the video (mq3.jpg, never the hand-made
 * thumbnail), cropped to a 4:3 lab-print format, as if the camera on the
 * table had photographed the shoot. Clicking it opens the video in a new tab.
 *
 * Structure: the <a> (.zone) is a STATIC hit area covering the union of the
 * tucked and slid-out poses — hover state can never oscillate, because the
 * hover target never moves. The print itself (motion.div) slides within it:
 * resting mostly behind the camera body with only the bottom "YouTube" strip
 * peeking out, sliding fully out on hover/focus. Same language as the
 * TRANSCRIPTION sheet under the album pile.
 *
 * The specular sheen (.gloss) belongs to the LIGHT, not the paper: it
 * counter-transforms with mirrored variants (translations halved — the span
 * is 200% of the print — and signs flipped) so it stays put in world space
 * while the print moves, as a real reflection would.
 */
const SPRING = { type: "spring", stiffness: 260, damping: 26, opacity: { type: "tween", duration: 0.25 } } as const;

const zoneVariants = {
  hidden: { opacity: 0 },
  peek: { opacity: 1 },
  out: { opacity: 1 },
};

const printVariants = {
  hidden: { x: "-60%", rotate: -6 },
  peek: { x: "-45%", rotate: -3 },
  out: { x: "0%", rotate: 6 },
};

const glossVariants = {
  hidden: { x: "30%", rotate: 6 },
  peek: { x: "22.5%", rotate: 3 },
  out: { x: "0%", rotate: -6 },
};

// Undeveloped-polaroid layer over the image: opaque while the print is
// tucked under the camera, and the picture DEVELOPS once it slides out —
// slow reveal (a real instant photo takes its time), quick re-darkening on
// the way back so it's opaque again before the next hover.
const developVariants: Variants = {
  hidden: { opacity: 1 },
  peek: { opacity: 1, transition: { duration: 0.4 } },
  out: { opacity: 0, transition: { duration: 0.8, ease: "easeInOut", delay: 0 } },
};

export default function VideoPrint(props: {
  link?: string,
  videoId: string | null,
  guestName: string,
  ready: boolean,
}) {
  return (
    <AnimatePresence mode="wait">
      {props.ready && props.videoId && props.link && (
        <motion.a
          // Stable key on purpose: at rest the print is an undeveloped
          // (black) polaroid tucked under the camera, visually identical for
          // every filmed episode — so animating out/in between two episodes
          // that BOTH have a video would be movement without change. The
          // frame swaps silently under the opaque chemistry layer; the
          // slide-under animation only plays when the video print actually
          // appears or disappears (episode with ↔ without youtubeLink).
          key="videoprint"
          className={styles.zone}
          href={props.link}
          target="_blank"
          rel="noopener noreferrer"
          draggable="false"
          variants={zoneVariants}
          initial="hidden"
          animate="peek"
          exit="hidden"
          whileHover="out"
          whileFocus="out"
          transition={SPRING}
        >
          <motion.div className={styles.print} variants={printVariants} transition={SPRING}>
            {/* The clipping window (4:3) — the img inside is zoomed to crop out
                the letterbox bars baked into YouTube's mq* frames */}
            <span className={styles.frameWrap}>
              { /* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.frame}
                src={getYoutubeFrameUrl(props.videoId)}
                alt={`Version vidéo de l'épisode avec ${props.guestName}`}
                loading="lazy"
                draggable="false"
              />
              {/* Undeveloped chemical layer — fades away as the photo develops */}
              <motion.span
                className={styles.develop}
                aria-hidden="true"
                variants={developVariants}
              />
            </span>
            <span className={styles.caption} aria-hidden="true">YouTube</span>
            {/* Glossy-paper sheen, world-fixed via mirrored counter-transform */}
            <motion.span
              className={styles.gloss}
              aria-hidden="true"
              variants={glossVariants}
              transition={SPRING}
            />
          </motion.div>
        </motion.a>
      )}
    </AnimatePresence>
  );
}

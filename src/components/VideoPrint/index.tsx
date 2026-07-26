import React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { getYoutubeFrameUrl } from "@/utils/youtubeLink";

import styles from "./videoprint.module.css";

/**
 * VideoPrint — a glossy photo lab print tucked UNDER the camera and phone
 * props on the table, shown only for episodes that have a filmed (YouTube)
 * version.
 *
 * The print shows a REAL frame from the video (mq1.jpg, never the hand-made
 * thumbnail), cropped to a 4:3 lab-print format, as if the camera on the
 * table had photographed the shoot. Clicking it opens the video in a new tab.
 *
 * Mounted permanently (where the camera prop is visible — on mobile portrait
 * the video link lives in the service bottom sheet instead): videoId may be
 * null, and AnimatePresence animates the print sliding out from under the
 * camera when the browsed episode has a video, and back under when it hasn't.
 *
 * The specular sheen (.gloss) belongs to the LIGHT, not the paper: while the
 * print moves (enter/exit/hover), the gloss counter-transforms with mirrored
 * variants so it stays put in world space, as a real reflection would. The
 * counter-translation is expressed in the gloss's own coordinate space —
 * the span is 200% of the print (inset: -50%), so every % is halved.
 */
const SPRING = { type: "spring", stiffness: 260, damping: 26, opacity: { type: "tween", duration: 0.25 } } as const;

const printVariants = {
  hidden: { opacity: 0, x: "-45%", y: "-18%", rotate: -8 },
  shown: { opacity: 1, x: "0%", y: "0%", rotate: 6 },
  hover: { opacity: 1, x: "0%", y: "0%", scale: 1.05, rotate: 4 },
};

const glossVariants = {
  hidden: { x: "22.5%", y: "9%", rotate: 8 },
  shown: { x: "0%", y: "0%", rotate: -6 },
  hover: { x: "0%", y: "0%", scale: 1 / 1.05, rotate: -4 },
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
          key={props.videoId}
          className={styles.print}
          href={props.link}
          target="_blank"
          rel="noopener noreferrer"
          draggable="false"
          // Slides out from under the camera body (up-left of its resting
          // spot), straightening as it comes to rest — and slips back the
          // same way when the browsed episode has no video.
          variants={printVariants}
          initial="hidden"
          animate="shown"
          exit="hidden"
          whileHover="hover"
          transition={SPRING}
        >
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
          </span>
          <span className={styles.caption} aria-hidden="true">YouTube</span>
          {/* Glossy-paper sheen, world-fixed via mirrored counter-transform */}
          <motion.span
            className={styles.gloss}
            aria-hidden="true"
            variants={glossVariants}
            transition={SPRING}
          />
        </motion.a>
      )}
    </AnimatePresence>
  );
}

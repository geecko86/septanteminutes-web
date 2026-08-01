import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { getGeneratedYoutubeFrameUrl, getYoutubeFrameUrl } from "@/utils/youtubeLink";

import styles from "./videoprint.module.css";

/**
 * VideoPrint — a glossy photo lab print tucked UNDER the camera prop on the
 * table, shown only for episodes that have a filmed (YouTube) version.
 *
 * The print shows a guest-focused 320x180 frame selected from YouTube's M13
 * storyboard during `yarn build`. Clicking it opens the video in a new tab.
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
const MAX_FRAME_RETRIES = 2;

const zoneVariants = {
  hidden: { opacity: 0 },
  peek: { opacity: 1 },
  out: { opacity: 1 },
};

const printVariants = {
  hidden: { x: "-60%", rotate: -6 },
  peek: { x: "-45%", rotate: -3 },
  out: { x: "12.5%", rotate: 6 },
};

const glossVariants = {
  hidden: { x: "30%", rotate: 6 },
  peek: { x: "22.5%", rotate: 3 },
  out: { x: "-6.25%", rotate: -6 },
};

const COVERED_FILTER = "brightness(0.72) contrast(0.86) saturate(0.12) sepia(0.3) blur(0.55px)";
const DEVELOPED_FILTER = "brightness(1.07) contrast(1.08) saturate(0.72) sepia(0.12) blur(0px)";
// Temporary comparison switch: leave the chemical reveal animation intact
// while showing the developed storyboard frame without its retro PostFX.
const RETRO_POST_FX_ENABLED = true;

function DevelopingFrame(props: {
  videoId: string,
  guestName: string,
  revealed: boolean,
}) {
  const prefersReducedMotion = useReducedMotion();
  const latestFrame = React.useRef({
    videoId: props.videoId,
    guestName: props.guestName,
  });
  latestFrame.current = {
    videoId: props.videoId,
    guestName: props.guestName,
  };

  const [displayedFrame, setDisplayedFrame] = React.useState(latestFrame.current);
  const [frameRetry, setFrameRetry] = React.useState(0);
  const [frameFormat, setFrameFormat] = React.useState<"webp" | "jpg">("webp");
  const [useGeneratedFrame, setUseGeneratedFrame] = React.useState(true);
  const [loaded, setLoaded] = React.useState(false);
  const [concealingForSwap, setConcealingForSwap] = React.useState(false);
  const frameUrl = useGeneratedFrame
    ? getGeneratedYoutubeFrameUrl(displayedFrame.videoId)
    : getYoutubeFrameUrl(displayedFrame.videoId, frameRetry, frameFormat);
  const covered = !props.revealed || !loaded || concealingForSwap;

  const showLatestFrame = React.useCallback(() => {
    setDisplayedFrame(latestFrame.current);
    setFrameRetry(0);
    setFrameFormat("webp");
    setUseGeneratedFrame(true);
    setLoaded(false);
    setConcealingForSwap(false);
  }, []);

  React.useEffect(() => {
    if (props.videoId === displayedFrame.videoId) {
      if (concealingForSwap) {
        // Navigation returned to the frame that is still on the paper. Reverse
        // the in-progress conceal instead of swapping/reloading the same JPEG.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- cancel transition in response to the restored external video ID
        setConcealingForSwap(false);
      }
      if (props.guestName !== displayedFrame.guestName) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- keep the loaded frame while refreshing its accessible name
        setDisplayedFrame((frame) => ({ ...frame, guestName: props.guestName }));
      }
      return;
    }

    if (props.revealed && loaded) {
      // Keep showing the old photograph while its chemistry reforms. The
      // overlay's completion callback performs the hidden JPEG handoff.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- transition state intentionally follows an external video ID change
      setConcealingForSwap(true);
    } else {
      // The picture is already chemically covered, so the handoff is invisible
      // and does not need an extra transition phase.
      showLatestFrame();
    }
  }, [concealingForSwap, displayedFrame.guestName, displayedFrame.videoId, loaded, props.guestName, props.revealed, props.videoId, showLatestFrame]);

  const transition = covered
    ? { duration: prefersReducedMotion ? 0.12 : 0.29, ease: "easeInOut" as const }
    : { duration: prefersReducedMotion ? 0.12 : 0.63, ease: "easeInOut" as const };

  return (
    <>
      <span className={styles.picture}>
        { /* eslint-disable-next-line @next/next/no-img-element */}
        <motion.img
          // Each retry gets a fresh request lifecycle. The DevelopingFrame
          // holds the old video through its conceal phase, then resets before
          // mounting the next frame behind opaque chemistry.
          key={frameUrl}
          className={styles.frame}
          src={frameUrl}
          alt={`Version vidéo de l'épisode avec ${displayedFrame.guestName}`}
          // The developed frame is hidden until the visitor reveals the print.
          loading="lazy"
          data-loaded={loaded}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            if (useGeneratedFrame) {
              // A transient build-time thumbnail failure should not leave the
              // print empty. Retry maxres2 directly from YouTube in-browser.
              setUseGeneratedFrame(false);
              setFrameFormat("webp");
              setFrameRetry(0);
            } else if (frameRetry < MAX_FRAME_RETRIES) {
              setFrameRetry((retry) => retry + 1);
            } else if (frameFormat === "webp") {
              // Some older uploads expose maxres2 only through the JPEG path.
              setFrameFormat("jpg");
              setFrameRetry(0);
            } else {
              // Both formats failed. Leave the accessible alt text in place.
              setFrameRetry(MAX_FRAME_RETRIES);
            }
          }}
          initial={false}
          animate={{
            filter: covered
              ? COVERED_FILTER
              : RETRO_POST_FX_ENABLED ? DEVELOPED_FILTER : "none",
          }}
          transition={transition}
          draggable="false"
        />
      </span>
      {/* Warm color-print patina, grain and optical falloff. Kept separate
          from the image so the source stays legible. */}
      {RETRO_POST_FX_ENABLED && (
        <>
          <span className={styles.patina} aria-hidden="true" />
          <span className={styles.vignette} aria-hidden="true" />
        </>
      )}
      {/* The old frame is chemically concealed before the hidden source swap;
          the new one then develops only after its JPEG has loaded. */}
      <motion.span
        className={styles.develop}
        aria-hidden="true"
        initial={false}
        animate={{ opacity: covered ? 1 : 0 }}
        transition={transition}
        onAnimationComplete={() => {
          if (concealingForSwap) showLatestFrame();
        }}
      />
    </>
  );
}

export default function VideoPrint(props: {
  link?: string,
  videoId: string | null,
  guestName: string,
  ready: boolean,
}) {
  const [revealed, setRevealed] = React.useState(false);

  return (
    <AnimatePresence mode="wait">
      {props.ready && props.videoId && props.link && (
        <motion.a
          // Stable key: at rest the print looks identical for every filmed
          // episode (undeveloped polaroid), so only appear/disappear animates.
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
          onHoverStart={() => setRevealed(true)}
          onHoverEnd={() => setRevealed(false)}
          onFocus={() => setRevealed(true)}
          onBlur={() => setRevealed(false)}
          transition={SPRING}
        >
          <motion.div className={styles.print} variants={printVariants} transition={SPRING}>
            {/* The clipping window (4:3) closely crops the M13 video frame. */}
            <span className={styles.frameWrap}>
              <DevelopingFrame
                videoId={props.videoId}
                guestName={props.guestName}
                revealed={revealed}
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

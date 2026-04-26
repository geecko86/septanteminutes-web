;

/**
 * VinylAlbum renders the spinning vinyl artwork on the episode page.
 *
 * Performance note: visibility, "moving" status, and shadow level are written
 * directly to the DOM via refs (className / dataset / hidden attribute) inside
 * the useMotionValueEvent callback, NOT via React state. The episode page mounts
 * 30+ VinylAlbums all subscribed to the same scrollYProgress; routing those
 * scroll-frequency updates through React caused dozens of re-renders per frame.
 * Direct DOM mutation eliminates that. See album.module.css for the matching
 * [data-moving="true"] / [data-visibility="hidden"] selectors.
 */

import React, { useState, useEffect, useRef, MouseEventHandler, ForwardedRef } from "react";
import {
  motion,
  useTransform,
  useSpring,
  useMotionValueEvent,
  MotionValue,
  MotionStyle,
} from "framer-motion";
import Image from "next/image";
import { useEventListener } from "usehooks-ts";

import styles from "./album.module.css";

const VinylAlbum = React.forwardRef(( {
    position,
    scrollYProgress,
    image = "",
    total,
    mayAnimate = false,
    alt = "",
    priority = false,
    type = "vinyl",
    episodeNumParam = -1,
    onSelect = () => {},
    onLoad = () => {},
    onMouseEnter = (_: any) => {},
    onMouseLeave = (_: any) => {},
  }: VinylProps, ref: ForwardedRef<HTMLImageElement>) => {
  const albumRotation = useSpring(0, {
    stiffness: 700,
    damping: 52,
    mass: 1.8,
  });
  const albumXOffset = useSpring(0, {
    stiffness: 700,
    damping: 52,
    mass: 1.8,
  });
  const albumYOffset = useSpring(0, {
    stiffness: 700,
    damping: 52,
    mass: 1.8,
  });

  const rotateZ = useTransform(
    albumRotation,
    [(total - position - 1) * -25 - 1, (total - position - 1) * -25 - 25],
    [0, -25]
  );

  const translateX = useTransform(
    albumXOffset,
    [(total - position - 1) * -500 - 25, (total - position - 1 + 1) * -500],
    ["-0vw", "-50vw"]
  );
  const translateY = useTransform(
    albumYOffset,
    [(total - position - 1) * -200 - 25, (total - position - 1 + 1) * -200],
    ["0%", "-66%"]
  );

  // `loaded` still drives a className on the Image, so it stays as state.
  const [loaded, setLoadedComplete] = useState(false);

  // `ignoreScroll` is read inside the scroll event callback — a ref is
  // sufficient here too since we never need a re-render when it changes.
  const ignoreScrollRef = useRef(false);

  // `jump` controls a one-shot behaviour inside the scroll callback.
  // No re-render is needed so we keep it as a ref.
  const jumpRef = useRef(true);

  // --- Refs for DOM nodes whose visual state is mutated directly on every
  //     animation frame, bypassing React's render cycle entirely. ---

  // The outer wrapper div for the vinyl (non-shadow) variant.
  // We toggle `hidden`, `data-visibility`, and the `moving` data-attribute on it.
  const hoverContainerRef = useRef<HTMLDivElement>(null);

  // The shadow div — we toggle its className to change the box-shadow level.
  const shadowDivRef = useRef<HTMLDivElement>(null);

  // The outer wrapper for the shadow variant — same data-visibility toggle.
  const shadowContainerRef = useRef<HTMLDivElement>(null);

  // Initial visibility: set data-visibility immediately on mount so the element
  // starts in the right state before any scroll event fires.
  const initiallyHidden = position > episodeNumParam;

  // This effect mirrors the old useEffect that drove `setHidden`. It now writes
  // directly to the DOM node instead of going through state.
  useEffect(() => {
    if (episodeNumParam == -1) return;

    const isHidden = mayAnimate
      ? position > episodeNumParam || episodeNumParam == -1
      : position > episodeNumParam;

    const target = type === "shadow" ? shadowContainerRef.current : hoverContainerRef.current;
    if (target) {
      target.dataset.visibility = isHidden ? "hidden" : "visible";
    }
  }, [mayAnimate, episodeNumParam, position, type]);

  useMotionValueEvent(scrollYProgress, "change", (progress: number) => {
    if (position != 0 && !ignoreScrollRef.current) {
      if (jumpRef.current) {
        albumRotation.jump(progress * (total - 1) * -25);
        albumYOffset.jump(progress * (total - 1) * -200);
        albumXOffset.jump(progress * (total - 1) * -500);
        jumpRef.current = false;
        return;
      }
      albumRotation.set(progress * (total - 1) * -25);
      albumYOffset.set(progress * (total - 1) * -200);
      albumXOffset.set(progress * (total - 1) * -500);
    }
  });

  useEventListener("resize", () => {
    // Pause scroll handling during resize to avoid visual glitches.
    ignoreScrollRef.current = true;
    const id = setTimeout(() => {
      ignoreScrollRef.current = false;
    }, 50);

    return () => {
      clearTimeout(id);
    }
  });

  // This is the hot path: fires on every animation frame during scroll.
  // We write directly to DOM refs — no setState, no React re-render.
  useMotionValueEvent(rotateZ, "change", (rotation) => {
    if (type === "shadow") {
      // Pick the right shadow class based on rotation angle.
      // Writing className directly skips React's reconciler entirely.
      const shadowEl = shadowDivRef.current;
      if (shadowEl) {
        const shadowClass =
          rotation >= -25 && rotation < -7
            ? styles.shadow24
            : rotation < -1
            ? styles.shadow8
            : "";
        shadowEl.className = `${styles.separate_shadow}${shadowClass ? " " + shadowClass : ""}`;
      }
    } else {
      const el = hoverContainerRef.current;
      if (el) {
        const gone = mayAnimate && rotation < -24;

        // `hidden` attribute hides the element from layout and accessibility tree —
        // same effect as the old `hidden={isGone}` JSX prop.
        el.hidden = gone;

        // data-visibility feeds the CSS selector that controls opacity/visibility.
        el.dataset.visibility = gone ? "hidden" : "visible";

        // data-moving drives pointer-events: none via an attribute selector in CSS
        // (replaces the `.moving` className toggle).
        el.dataset.moving = rotation < 0 ? "true" : "false";
      }
    }

    if (rotation == -25) onSelect();
  });

  const style = mayAnimate ? {
    translateX,
    translateY,
    rotateZ,
    zIndex: (type == "shadow" ? 1 : 0),
    visibility: rotateZ.get() == -25 ? "collapse" : "inherit",
  } : {};

  return type === "shadow" ? (
    // Use ref so the effect above can write data-visibility without setState.
    <div
      ref={shadowContainerRef}
      className={styles.shadow_container}
      data-visibility={initiallyHidden ? "hidden" : "visible"}
    >
      <motion.div
        ref={shadowDivRef}
        className={styles.separate_shadow}
        style={style as MotionStyle}
      />
    </div>
    )
  : (
      // `data-moving` replaces the `.moving` className toggle.
      // Initial values mirror what the old state initialised to.
      <div
        ref={hoverContainerRef}
        className={styles.hover_container}
        data-visibility={initiallyHidden ? "hidden" : "visible"}
        data-moving="false"
      >
        <motion.div
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={styles.album}
          style={style as MotionStyle}
        >
          <Image draggable="false"
            src={image}
            alt={alt}
            fill={true}
            ref={ref}
            priority={priority}
            className={!loaded ? styles.image_loading : ""}
            sizes="(max-width: 481px) 50vw,(min-width: 482px) 20vw, 20vw"
            quality={
              // Pick a lower quality on touch/mobile screens to save bandwidth.
              // Evaluated client-side at render time — safe in a Client Component.
              (typeof window !== "undefined" && (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0)) ? 30 : 70
            }
            onLoad={() => {
              setLoadedComplete(true);
              // Read hidden state directly from the DOM node — no isGone state needed.
              if (!hoverContainerRef.current?.hidden && onLoad) onLoad();
            }}
          />
          <Image draggable="false"
            src="https://framerusercontent.com/images/xASprVMQ8YKj6GHkS84CpZ7ElQ.png"
            alt=""
            fill={true}
            priority={priority}
            quality={40}
            className={styles.wrinkles}
            sizes="(max-width: 481px) 50vw,(min-width: 482px) 20vw, 20vw"
          />
        </motion.div>
      </div>);
  }
);
VinylAlbum.displayName = "VinylAlbum";

const ShadowAlbum = (props: VinylProps) => {
  const {
    position,
    scrollYProgress,
    total,
    mayAnimate = false,
    type = "shadow",
  } = props;
  return (
    <VinylAlbum
      position={position}
      scrollYProgress={scrollYProgress}
      total={total}
      mayAnimate={mayAnimate}
      type={type}
    />
  )
};

type VinylProps = {
  position: number,
  priority?: boolean,
  scrollYProgress: MotionValue,
  image?: string,
  total: number,
  mayAnimate: boolean,
  type?: string,
  onLoad?: () => void,
  episodeNumParam?: number,
  alt?: string,
  onSelect?: () => void,
  onMouseEnter?: MouseEventHandler<HTMLDivElement>,
  onMouseLeave?: MouseEventHandler<HTMLDivElement>
}

export { VinylAlbum as default, ShadowAlbum };

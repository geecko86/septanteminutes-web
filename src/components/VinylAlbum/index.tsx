"use client";

import React, { useState, useEffect, MouseEventHandler, ForwardedRef } from "react";
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
    ["0%", "-266%"]
  );
  const translateY = useTransform(
    albumYOffset,
    [(total - position - 1) * -200 - 25, (total - position - 1 + 1) * -200],
    ["0%", "-66%"]
  );

  const [isHidden, setHidden] = useState(position > episodeNumParam);
  const [loaded, setLoadedComplete] = useState(false);
  const [isGone, setGone] = useState(false);
  const [shadowLevel, setShadowLevel] = useState("");
  const [ignoreScroll, setIgnoreScroll] = useState(false);
  const [isMoving, setMoving] = useState(false);
  const [jump, setJump] = useState(true);

  useEffect(() => {
    if (episodeNumParam == -1) return;
    if (!mayAnimate) {
      if (position <= episodeNumParam) setHidden(false);
    } else {
      setHidden(((position > episodeNumParam || episodeNumParam == -1)));
    }
  }, [mayAnimate, episodeNumParam, position]);

  useMotionValueEvent(scrollYProgress, "change", (progress: number) => {
      if (position != 0 && !ignoreScroll) {
        if (jump) {
          albumRotation.jump(progress * (total - 1) * -25);
          albumYOffset.jump(progress * (total - 1) * -200);
          albumXOffset.jump(progress * (total - 1) * -500);
          setJump(false);
          return;
        }
        albumRotation.set(progress * (total - 1) * -25);
        albumYOffset.set(progress * (total - 1) * -200);
        albumXOffset.set(progress * (total - 1) * -500);
      }
  });

  useEventListener("resize", () => {
    setIgnoreScroll(true);
    const id = setTimeout(() => {
      setIgnoreScroll(false);
    }, 50);

    return () => {
      clearTimeout(id);
    }
  });

  useMotionValueEvent(rotateZ, "change", (rotation) => {
    if (mayAnimate) {
      setGone(rotation < -24);
      setHidden(rotation < -24);
    }
    setShadowLevel(
      rotation >= -25 && rotation < -7
        ? styles.shadow24
        : rotation < -1
        ? styles.shadow8
        : ""
    );
    setMoving(rotation < 0);
    if (rotation == -25) onSelect(); // Somehow fixes the issue of resizing the window but how...?
  });

  const style = mayAnimate ? {
    translateX,
    translateY,
    rotateZ,
    zIndex: (type == "shadow" ? 1 : 0),
    visibility: rotateZ.get() == -25 ? "collapse" : "inherit",
  } : {};

  return type === "shadow" ? (
    <div className={styles.shadow_container} data-visibility={isHidden ? "hidden" : "visible"}>
      <motion.div
        className={`${styles.separate_shadow} ${shadowLevel}`}
        style={style as MotionStyle}
      />
    </div>
    ) 
  : (
      <div
        className={[styles.hover_container, isMoving ? styles.moving : ""].join(
          " "
        )}
        data-visibility={isHidden ? "hidden" : "visible"}
        hidden={isGone}
      >
        <motion.div
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={styles.album}
          style={style as MotionStyle}
        >
          <Image
            src={image}
            alt={alt}
            fill={true}
            ref={ref}
            priority={priority}
            className={!loaded ? styles.image_loading : ""}
            sizes="(max-width: 481px) 50vw,(min-width: 482px) 20vw, 20vw"
            onLoad={() => {
              setLoadedComplete(true);
              if (!isGone && onLoad) onLoad()
            }}
          />
          <Image
            src="https://framerusercontent.com/images/xASprVMQ8YKj6GHkS84CpZ7ElQ.png"
            alt=""
            fill={true}
            priority={true}
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

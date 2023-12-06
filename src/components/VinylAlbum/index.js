"use client";

import styles from "./album.module.css";

import { useState, useEffect } from "react";
import {
  motion,
  useTransform,
  useSpring,
  useMotionValueEvent,
} from "framer-motion";
import Image from "next/image";
import { useEventListener } from "usehooks-ts";

const VinylAlbum = ({
  position,
  scrollYProgress,
  image,
  total,
  episodeNumParam= -1,
  mayAnimate = false,
  alt = "",
  type = "vinyl",
  onMouseEnter = (e) => {},
  onMouseLeave = (e) => {},
}) => {
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
  const [timeoutId, setTimeoutId] = useState(0);

  useEffect(() => {
    if (episodeNumParam == -1) return;
    if (!mayAnimate) {
      if (position <= episodeNumParam) setHidden(false)
    } else {
      setHidden(((position > episodeNumParam || episodeNumParam == -1)));
    }
  }, [mayAnimate, episodeNumParam, position]);

  useEffect(() =>
    scrollYProgress.on("change", (progress) => {
      if (position != 0 && !ignoreScroll) {
        albumRotation.set(progress * (total - 1) * -25);
        albumYOffset.set(progress * (total - 1) * -200);
        albumXOffset.set(progress * (total - 1) * -500);
      }
    })
  );

  useEventListener("resize", () => {
    setIgnoreScroll(true);
    if (timeoutId) clearTimeout(timeoutId);
    const newId = setTimeout(() => {
      setIgnoreScroll(false);
    }, 50);
    setTimeoutId(newId);
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
  });

  const style = mayAnimate ? {
    translateX,
    translateY,
    rotateZ,
    zIndex: (type == "shadow" ? 1 : 0),
    visibility: rotateZ.current == -25 ? "collapse" : "inherit",
  } : {};

  return type === "shadow" ? (
    <div className={styles.shadow_container} data-visibility={isHidden ? "hidden" : "visible"}>
      <motion.div
        className={`${styles.separate_shadow} ${shadowLevel}`}
        style={style}
      />
    </div>
  ) : (
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
        style={{ ...style }}
      >
        <Image
          src={image}
          alt={alt}
          fill={true}
          className={!loaded ? styles.image_loading : ""}
          sizes="(max-width: 481px) 50vw,(min-width: 482px) 20vw, 20vw"
          onLoad={() => {
            setLoadedComplete(true);
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
    </div>
  );
};

const ShadowAlbum = ({
  position,
  scrollYProgress,
  image,
  total,
  mayAnimate = false,
  type = "shadow",
}) => {
  return VinylAlbum({
    position,
    scrollYProgress,
    image,
    total,
    mayAnimate,
    type,
  });
};

export { VinylAlbum as default, ShadowAlbum };

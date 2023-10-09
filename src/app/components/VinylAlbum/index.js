"use client";

import styles from "./album.module.css";

import { useState } from "react";
import {
  motion,
  useTransform,
  useSpring,
  useMotionValueEvent,
} from "framer-motion";
import { useEventListener } from 'usehooks-ts'

import Vinyl from "https://framer.com/m/Vynil-Copy-STPN.js@q9hC2XpeKHiuA8fEujyh";

const VinylAlbum = ({
  position,
  scrollYProgress,
  image,
  total,
  type = "vinyl",
  onMouseEnter = e => {},
  onMouseLeave = e => {}
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
    [position * -25 - 1, (position * -25) - 25],
    [0, -25]
  );

  const translateX = useTransform(
    albumXOffset,
    [position * -500 - 25, (position + 1) * -500],
    ["0%", "-266%"]
  );
  const translateY = useTransform(
    albumYOffset,
    [position * -200 - 25, (position + 1) * -200],
    ["0%", "-66%"]
  );

  const [isGone, setGone] = useState(rotateZ == -25);
  const [shadowLevel, setShadowLevel] = useState("");
  const [ignoreScroll, setIgnoreScroll] = useState(false);
  const [timeoutId, setTimeoutId] = useState(0);

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (position != total - 1 && !ignoreScroll) {
      albumRotation.set(progress * (total - 1) * -25);
      albumXOffset.set(progress * (total - 1) * -500);
      albumYOffset.set(progress * (total - 1) * -200);
    }
  });

  useEventListener('resize', () => {
    setIgnoreScroll(true);
    if (timeoutId) clearTimeout(timeoutId);
    const newId = setTimeout(() => {
      setIgnoreScroll(false);
    }, 50);
    setTimeoutId(newId);
  });

  useMotionValueEvent(rotateZ, "change", (rotation) => {
    setGone(rotation < -24);
    setShadowLevel(rotation >= -25 && rotation < -7 ? styles.shadow24 : rotation < -1 ? styles.shadow8 : "");
  });

  const style = {
    translateX,
    translateY,
    rotateZ,
    zIndex: (total - position + (type == "shadow" ? 1 : 0)),
    visibility: rotateZ.current == -25 ? "collapse" : "inherit"
  };

  return type === "shadow" ? (
    <div className={styles.shadow_container}>
      <motion.div
        className={`${styles.separate_shadow} ${shadowLevel}`}
        hidden={isGone}
        style={style}
      />
    </div>
  ) : (
    <motion.div
      hidden={isGone}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={styles.album}
      style={style}
    >
      <Vinyl image={image} />
    </motion.div>
  );
};

const ShadowAlbum = ({
  position,
  scrollYProgress,
  image,
  total,
  type = "shadow"
}) => {
  return (
    VinylAlbum({
      position,
      scrollYProgress,
      image,
      total,
      type
    })
  );
}

export { VinylAlbum as default, ShadowAlbum };

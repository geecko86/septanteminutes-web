"use client";

import styles from "./album.module.css";

import { useState, useEffect } from "react";
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
  onMouseEnter = e => { },
  onMouseLeave = e => { }
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
    [(total - position - 1) * -25 - 1, ((total - position - 1) * -25) - 25],
    [0, -25]
  );

  const translateX = useTransform(
    albumXOffset,
    [(total - position - 1) * -500 - 25, ((total - position - 1) + 1) * -500],
    ["0%", "-266%"]
  );
  const translateY = useTransform(
    albumYOffset,
    [(total - position - 1) * -200 - 25, ((total - position - 1) + 1) * -200],
    ["0%", "-66%"]
  );

  const [isGone, setGone] = useState(rotateZ == -25);
  const [shadowLevel, setShadowLevel] = useState("");
  const [ignoreScroll, setIgnoreScroll] = useState(false);
  const [isMoving, setMoving] = useState(false);
  const [timeoutId, setTimeoutId] = useState(0);

  useEffect(() => scrollYProgress.onChange(progress => {
    if (position == 60) console.log(progress, position, total);
    if (position != 0 && !ignoreScroll) {
      albumRotation.set(progress * (total - 1) * -25);
      albumYOffset.set(progress * (total - 1) * -200);
      albumXOffset.set(progress * (total - 1) * -500);
    }
  }));

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
    setMoving(rotation < 0);
  });

  const style = {
    translateX,
    translateY,
    rotateZ,
    zIndex: (position + (type == "shadow" ? 1 : 0)),
    visibility: rotateZ.current == -25 ? "collapse" : "inherit"
  };

  return type === "shadow" ? (
    <div className={styles.shadow_container}
      hidden={isGone}>
      <motion.div
        className={`${styles.separate_shadow} ${shadowLevel}`}
        style={style}
      />
    </div>
  ) : (
    <div
      className={[styles.hover_container, isMoving ? styles.moving : ""].join(" ")}
      hidden={isGone}
    >
      <motion.div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        className={styles.album}
        style={style}
      >
        <img src={image} loading="lazy" />
        <img className={styles.wrinkles} src="/img/vinyl_box.webp" />
      </motion.div>
    </div>
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

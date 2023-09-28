"use client";

import styles from "./album.module.css";

import { useState } from "react";
import {
  motion,
  useTransform,
  useSpring,
  useMotionValueEvent,
} from "framer-motion";
import Vinyl from "https://framer.com/m/Vynil-Copy-STPN.js@q9hC2XpeKHiuA8fEujyh";

const VinylAlbum = ({
  position,
  scrollYProgress,
  image,
  total
}) => {
  
  const albumRotation = useSpring(0, {
    stiffness: 1000,
    damping: 52,
    mass: 1.8,
  });
  const albumXOffset = useSpring(0, {
    stiffness: 1000,
    damping: 52,
    mass: 1.8,
  });
  const albumYOffset = useSpring(0, {
    stiffness: 1000,
    damping: 52,
    mass: 1.8,
  });

  const rotateZ = useTransform(
    albumRotation,
    [position * -25, (position * -25) - 25],
    [0, -25]
  );

  const [isGone, setGone] = useState(rotateZ == -25);
  const [shadowClass, setShadow] = useState("");

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (position != total-1) {
        albumRotation.set(progress * total * -25);
        albumXOffset.set(progress * total * -500);
        albumYOffset.set(progress * total * -200);
    }
  });

  useMotionValueEvent(rotateZ, "change", (progress) => {
    setGone(rotateZ.get() == -25);
    setShadow(rotateZ.get() >= -25 && rotateZ.get() < -5 ? styles.shadow8 : rotateZ.get() < -1 ? styles.shadow24 : "");
  });

  return (
    <motion.div
      hidden={isGone}
      className={`${shadowClass} ${styles.album}`}
      style={{
        rotateZ,
        translateX: useTransform(
          albumXOffset,
          [position * -500, (position * -500) - 500],
          ["0%", "-213%"]
        ),
        translateY: useTransform(
          albumYOffset,
          [position * -200, (position * -200) - 200],
          ["0%", "-66%"]
        ),
        visibility: rotateZ.current == -25 ? "collapse" : "inherit"
      }}
    >
      <Vinyl image={image} />
    </motion.div>
  );
};

export default VinylAlbum;

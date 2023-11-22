import React from "react";
import { motion } from "framer-motion";

import styles from "./index.module.css";

export default function App(props: {play: boolean}) {
  return (
    <motion.div
      className={styles.box}
      initial={{
        opacity: 0,
        scale: 0.6,
        x: "0vw",
        scaleX: 1
      }}
      animate={props.play ? {
        opacity: [0, 1, 1, 0],
        scale: [0.6, 1.3, 1, 1, 1.5],
        scaleX: [-1, -1, 1, 1],
        x:         ["0vw", "0vw", "-25vw", "-25vw", "-25vw", "-25vw", "0vw", "0vw"]
      } : { }}
      transition={{
        ease: "easeInOut",
        x: {
            duration: 1,
            times: [0,      0.15,   0.4,    0.5,        0.7,   0.85, 1.1,   1.2]
        },
        scaleX: {
            duration: 1,
            times: [0, 0.5, 0.51, 1]
        },
        scale: {
            duration: 0.5,
            times: [0, 0.2, 0.3, 0.8, 1],
            repeat: 1,
            repeatType: "loop",
            repeatDelay: 0.2
        },
        opacity: {
            duration: 0.5,
            times: [0, 0.3, 0.8, 1],
            repeat: 1,
            repeatType: "loop",
            repeatDelay: 0.2
        },
      }}
    />
  );
};

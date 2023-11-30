import React, { useEffect, useState, useRef } from "react";
import { motion, animate, AnimationPlaybackControls } from "framer-motion";

import styles from "./index.module.css";

export default function App(props: { play: boolean, className: string }) {

    const {
        play,
        className
    } = props;

    const [anim, setAnim] = useState<AnimationPlaybackControls | undefined>(undefined);

    const sequence = [
        [`.${styles.box}`, { opacity: 0, scaleX: -1, x: "0vw", scale: 0.6 }, { duration: 0 }],
        [`.${styles.box}`, { opacity: 1 }, { duration: 0.15, at: 0, ease: "easeInOut" }],
        [`.${styles.box}`, { opacity: 0 }, { duration: 0.4, at: 0.45, ease: "easeInOut" }],
        [`.${styles.box}`, { opacity: 1 }, { duration: 0.25, at: 1.35, ease: "easeInOut" }],
        [`.${styles.box}`, { opacity: 0 }, { duration: 0.25, at: 2.25, ease: "easeInOut" }],

        [`.${styles.box}`, { x: "-25vw" }, { duration: 0.45, at: 0.35, ease: "easeInOut" }],
        [`.${styles.box}`, { x: "0vw" }, { duration: 0.45, at: 1.65, ease: "easeInOut" }],
        
        [`.${styles.box}`, { scale: 1.3 }, { duration: 0.2, at: 0, ease: "easeInOut" }],
        [`.${styles.box}`, { scale: 1 }, { duration: 0.1, at: 0.2, ease: "easeInOut" }],
        [`.${styles.box}`, { scale: 1.5 }, { duration: 0.2, at: 0.75, ease: "easeInOut" }],
        [`.${styles.box}`, { scale: 0.6 }, { duration: 0.01, at: 1.25, ease: "easeInOut" }],
        [`.${styles.box}`, { scale: 1.3 }, { duration: 0.2, at: 1.3, ease: "easeInOut" }],
        [`.${styles.box}`, { scale: 1 }, { duration: 0.2, at: 1.5, ease: "easeInOut" }],
        [`.${styles.box}`, { scale: 1.5 }, { duration: 0.2, at: 2.05, ease: "easeInOut" }],
        
        [`.${styles.box}`, { scaleX: 1 }, { duration: 0.01, at: 1.15, ease: "easeInOut" }],
        [`.${styles.box}`, { scaleX: -1 }, { duration: 0.01, at: 2.5, ease: "easeInOut" }],
    ];

    useEffect(() => {
        if (play) {
            setAnim(animate(sequence as any, {
                ease: "easeInOut"
            }));
        } else if (anim) {
            animate(`.${styles.box}`, { opacity: 0 }, { duration: 0.2, ease: "easeInOut" }).then(() => {
                anim.cancel();
                setAnim(undefined);
            });
        }
    }, [play]);

    const defaultStyle = {
        opacity: 0,
        scale: 0.6,
        x: "0vw",
        scaleX: 1
    };
    return (
        <div className={className}>
            <motion.div
                className={styles.box}
                style={defaultStyle}                
            />
        </div>
    );
};
import React, { useEffect, useState, useRef } from "react";
import { motion, animate, AnimationPlaybackControls } from "framer-motion";

import styles from "./index.module.css";

export default function IdleSwipeAnim(props: { play: boolean, className: string }) {

    const {
        play,
        className
    } = props;

    const [anim, setAnim] = useState<AnimationPlaybackControls | undefined>(undefined);

    useEffect(() => {
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
        const sequence = isTouchDevice ? [
            [`.${styles.box}`, { opacity: 0, scaleX: -1, x: "0vw", scale: 0.6 }, { duration: 0 }],
            [`.${styles.box}`, { opacity: 1 }, { duration: 0.15, at: 0, ease: "easeInOut" }],
            [`.${styles.box}`, { opacity: 0 }, { duration: 0.4, at: 0.5, ease: "easeInOut" }],
            [`.${styles.box}`, { opacity: 1 }, { duration: 0.25, at: 1.35, ease: "easeInOut" }],
            [`.${styles.box}`, { opacity: 0 }, { duration: 0.25, at: 2.25, ease: "easeInOut" }],
    
            [`.${styles.box}`, { x: "-25vw" }, { duration: 0.45, at: 0.35, ease: "easeInOut" }],
            [`.${styles.box}`, { x: "0vw" }, { duration: 0, at: 1, ease: "easeInOut" }],
            [`.${styles.box}`, { x: "-25vw" }, { duration: 0.45, at: 1.65, ease: "easeInOut" }],
    
            [`.${styles.box}`, { scale: 1 }, { duration: 0.2, at: 0, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 1 }, { duration: 0.1, at: 0.2, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 1 }, { duration: 0.2, at: 0.75, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 0.6 }, { duration: 0.01, at: 1.25, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 1.3 }, { duration: 0.2, at: 1.3, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 1 }, { duration: 0.2, at: 1.5, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 1 }, { duration: 0.2, at: 2.05, ease: "easeInOut" }],
        ] : [
            [`.${styles.box}`, { opacity: 0, scaleX: -1, x: "0vw", scale: 0.6, rotate: "270deg" }, { duration: 0 }],
            [`.${styles.box}`, { opacity: 1 }, { duration: 0.15, at: 0, ease: "easeInOut" }],
            [`.${styles.box}`, { opacity: 0 }, { duration: 0.4, at: 0.75, ease: "easeInOut" }],
            [`.${styles.box}`, { opacity: 1 }, { duration: 0.25, at: 1.35, ease: "easeInOut" }],
            [`.${styles.box}`, { opacity: 0 }, { duration: 0.4, at: 2.00, ease: "easeInOut" }],
    
            [`.${styles.box}`, { y: "25vw" }, { duration: 0.45, at: 0.35, ease: "easeInOut" }],
            [`.${styles.box}`, { y: "0vw" }, { duration: 0.45, at: 1.65, ease: "easeInOut" }],
            
            [`.${styles.box}`, { scale: 1.3 }, { duration: 0.2, at: 0, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 1 }, { duration: 0.1, at: 0.2, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 1.5 }, { duration: 0.2, at: 0.75, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 0.6 }, { duration: 0.01, at: 1.25, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 1.3 }, { duration: 0.2, at: 1.3, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 1 }, { duration: 0.2, at: 1.5, ease: "easeInOut" }],
            [`.${styles.box}`, { scale: 1.5 }, { duration: 0.2, at: 2.05, ease: "easeInOut" }],
            
            [`.${styles.box}`, { rotate: "90deg" }, { duration: 0.01, at: 1.25, ease: "easeInOut" }],
            [`.${styles.box}`, { rotate: "270deg" }, { duration: 0.01, at: 2.51, ease: "easeInOut" }],
        ];

        if (play && !anim) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: stores animation controls object in state to allow cancel on unmount
            setAnim(animate(sequence as any, {
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 1.75
            }));
        } else if (!play) {
            animate(`.${styles.box}`, { opacity: 0 }, { duration: 0.2, ease: "easeInOut" }).then(() => {
                anim?.cancel();
                setAnim(undefined);
            });
        }
    }, [play, anim]);

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
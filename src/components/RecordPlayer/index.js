

import React, { useEffect, useState } from 'react';
import Image from "next/image";

import { Vinyl_Base as Vinyl, Needle } from "../../framer/ImageWrapper"
import styles from './Player.module.css';

const RecordPlayer = ({className, playing, onClick}) => {

    const [needleHovered, setNeedleHovered] = useState(false);

    return (<div className={`${className} ${styles.player}`}>
        <Image draggable="false" src="https://framerusercontent.com/images/vVd897dq9a3NfXBgLf0vXNFfpB0.webp" alt="" priority sizes='20vmax' fill/>
        <Image draggable="false" src="https://framerusercontent.com/images/XcxoBsaaXbRA34sHY4OH8eIn60.webp" alt="" priority sizes='(max-width: 1200px) 54vw, 18vw' fill className={`${styles.needle} ${styles.needle_base}`} />
        <Needle className={`${styles.needle} ${playing ? styles.playing_needle : ""}`} onClick={onClick} priority onHoverStart={ () => setNeedleHovered(true) } onHoverEnd={ () => setNeedleHovered(false) } style={{ zIndex: 5, width: "fit-content", rotate: 0 }} animate={{ rotate: needleHovered ? 2 : 0 }} transition={{ damping: 60, delay: 0, mass: 1, stiffness: 500, type: "spring" }} />
        <Vinyl className={`${styles.disk} ${playing ? styles.playing_disk : ""}`} priority />
        <Image draggable="false" placeholder='blur' blurDataURL='data:image/webp;base64,UklGRpQAAABXRUJQVlA4WAoAAAAQAAAACwAACwAAQUxQSFYAAAAFYBvbtqnzvo3I/Rf2I9u80UcJETEB+Ju9EWTxJIgGP66Kq3nLfOrgjdMypfA+rn1UY2tiMEF0JqOr3SI/0lR1ErsWTlXTs53BsfsG+OI48LwQXhLeAlZQOCAYAAAAMAEAnQEqDAAMAAQAaCWkAANwAP7ywgAA' src="https://framerusercontent.com/images/uFFvuLhLGlvEmeGjj9m2rQbbNto.webp" priority={false} alt="" fill sizes='(pointer:coarse) and (orientation: portrait) 25vw, 30vh' quality={30} className={styles.reflection} onClick={onClick} />
    </div>);
};

export default RecordPlayer;
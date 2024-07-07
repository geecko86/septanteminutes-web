

import React, { useState } from 'react';
import Image from "next/image";

import { Vinyl_Base as Vinyl, Needle } from "../../framer/ImageWrapper"
import styles from './Player.module.css';

const RecordPlayer = ({className, playing, onClick}) => {

    const [needleHovered, setNeedleHovered] = useState(false);

    return (<div className={`${className} ${styles.player}`}>
        <Image draggable="false" src="https://framerusercontent.com/images/vVd897dq9a3NfXBgLf0vXNFfpB0.webp" alt="" priority sizes='28vmax' fill/>
        <Image draggable="false" src="https://framerusercontent.com/images/XcxoBsaaXbRA34sHY4OH8eIn60.webp" alt="" priority sizes='(max-width: 1200px) 54vw, 18vw' fill className={`${styles.needle} ${styles.needle_base}`} />
        <Needle className={`${styles.needle} ${playing ? styles.playing_needle : ""}`} onClick={onClick} priority onHoverStart={ () => setNeedleHovered(true) } onHoverEnd={ () => setNeedleHovered(false) } style={{ zIndex: 5, width: "fit-content", rotate: 0 }} animate={{ rotate: needleHovered ? 2 : 0 }} transition={{ damping: 60, delay: 0, mass: 1, stiffness: 500, type: "spring" }} />
        <Vinyl className={`${styles.disk} ${playing ? styles.playing_disk : ""}`} />
        <Image draggable="false" src="https://framerusercontent.com/images/uFFvuLhLGlvEmeGjj9m2rQbbNto.webp" alt="" fill sizes='18.43vmax' className={styles.reflection} onClick={onClick} />
    </div>);
}

export default RecordPlayer;
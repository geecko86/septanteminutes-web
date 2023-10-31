'use client'

import React, { useState } from 'react';
import Image from "next/image";

import Vinyl from "../../framer/Vinyl-BASE-09DQ";
import Needle from "../../framer/Needle_cut-us2p";
import styles from './Player.module.css';

const RecordPlayer = ({className}) => {
    const [playing, setPlaying] = useState(false);

    return (<div className={`${className} ${styles.player}`}>
        <Image src="https://framerusercontent.com/images/vVd897dq9a3NfXBgLf0vXNFfpB0.webp" alt="" sizes='28vmax' fill/>
        <Image src="https://framerusercontent.com/images/XcxoBsaaXbRA34sHY4OH8eIn60.webp" alt="" sizes='(max-width: 1200px) 54vw, 18vw' fill objectFit='cover' className={`${styles.needle} ${styles.needle_base}`} />
        <Needle className={`${styles.needle} ${playing ? styles.playing_needle : ""}`} onClick={() => setPlaying(!playing)} />
        <Vinyl className={`${styles.disk} ${playing ? styles.playing_disk : ""}`} />
        <Image src="https://framerusercontent.com/images/uFFvuLhLGlvEmeGjj9m2rQbbNto.webp" alt="" fill sizes='18.43vmax' className={styles.reflection} onClick={() => setPlaying(!playing)} />
    </div>);
}

export default RecordPlayer;
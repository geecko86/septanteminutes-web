'use client'

import React, { useState } from 'react';
import Image from "next/image";

import { Vinyl_Base as Vinyl } from "../../framer/ImageWrapper"
import Needle from "../../framer/Needle_cut-us2p";
import styles from './Player.module.css';

const RecordPlayer = ({className, playing, onClick}) => {

    return (<div className={`${className} ${styles.player}`}>
        <Image src="https://framerusercontent.com/images/vVd897dq9a3NfXBgLf0vXNFfpB0.webp" alt="" sizes='28vmax' fill/>
        <Image src="https://framerusercontent.com/images/XcxoBsaaXbRA34sHY4OH8eIn60.webp" alt="" sizes='(max-width: 1200px) 54vw, 18vw' fill className={`${styles.needle} ${styles.needle_base}`} />
        <Needle className={`${styles.needle} ${playing ? styles.playing_needle : ""}`} onClick={onClick} />
        <Vinyl className={`${styles.disk} ${playing ? styles.playing_disk : ""}`} />
        <Image src="https://framerusercontent.com/images/uFFvuLhLGlvEmeGjj9m2rQbbNto.webp" alt="" fill sizes='18.43vmax' className={styles.reflection} onClick={onClick} />
    </div>);
}

export default RecordPlayer;
'use client'

import React, { useState } from 'react';
import Needle from "https://framer.com/m/Vinyl-CAF-d-Needle-us2p.js@sOM1QI54B9pYOUwmEKNx";
import VinylReflection from "https://framer.com/m/Vinyl-Reflection-IINh.js@RmfraWHlkM4fSssHxhWZ";
import Vinyl from "https://framer.com/m/Vinyl-BASE-O9DQ.js@xzjYq9eqSbN4j5mTg1pW";
import styles from './Player.module.css';

const RecordPlayer = ({className}) => {

    const [playing, setPlaying] = useState(false);

    return (<div className={`${className} ${styles.player}`}>
        <div className={`${styles.needle} ${styles.needle_base}`} />
        <Needle className={styles.needle} start={playing || undefined} onClick={() => setPlaying(!playing)} />
        <Vinyl className={styles.disk} start={playing || undefined} />
        <VinylReflection className={styles.reflection} onClick={() => setPlaying(!playing)} />
    </div>);
}

export default RecordPlayer;
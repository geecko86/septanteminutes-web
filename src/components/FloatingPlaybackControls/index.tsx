'use client'

import React, { SetStateAction, useEffect, useState } from 'react';
import Slider from 'rc-slider';
import Link from 'next/link'

import MaterialSpinningLoader from "../MaterialSpinningLoader";
import { usePlayback, hackAutoplay } from '../../utils/PlayerContext';

import 'rc-slider/assets/index.css';
import styles from "./controls.module.css";
import { isIOS } from 'react-device-detect';

const railStyle = {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
};

const trackStyle = {
    backgroundColor: "rgba(0, 0, 0, 0.7)"
};

const handleStyle = {
    backgroundColor: "rgba(0, 0, 0, 1)",
    border: "none",
    display: "none"
};

const Controls = () => {

    const [hovered, setHovered] = useState(false);
    const [hoverTimeoutId, setHoverTimeoutId] = useState<NodeJS.Timeout | undefined>(undefined);
    const [progress, setProgress] = useState(0.0);
    const [showAudioElement, setShowAudioElement] = useState(false);

    const { playbackMP3: mp3, audio: audio, playbackNum: num, playbackTitle: title, setPlaying, isPlaying, status } = usePlayback();

    const active = !!mp3 && !!num && !!title;

    const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.keyCode == 32) {
            setPlaying(playing => !playing);
            e.preventDefault();
        }
    };

    useEffect(() => {
        setShowAudioElement(isIOS);
    }, []);

    useEffect(() => {
        if (!isIOS) return;
        var callback : (ev: Event) => void;
        callback = (_: Event) => {
            if (audio) hackAutoplay(audio).then(() => {
                removeEventListener('touchstart', callback);
            });
        }
        addEventListener('touchstart', callback);
        return () => {
            removeEventListener('touchstart', callback);
        }
    }, [audio]);

    useEffect(() => {
        if (!audio) return;

        const progressCallback = () => {
            if (audio) setProgress(audio.currentTime)
        };

        progressCallback();

        (audio as HTMLAudioElement).addEventListener("timeupdate", progressCallback, { passive: true });
        return () => { (audio as HTMLAudioElement).removeEventListener("timeupdate", progressCallback) }
    }, [audio, audio?.paused]);

    let formattedProgress = "", formattedDuration = "";
    if (audio?.duration) {
        formattedProgress = formatTime(progress || 0);
        formattedDuration = formatTime(audio.duration);
    }

    return (
        <>
            <div className={[styles.frame, active ? styles.active : styles.hidden, hovered && status >= 3 ? styles.hovered : ""].join(" ")} tabIndex={0} onKeyDown={handleKeyPress}
                onMouseLeave={() => {
                    if (hoverTimeoutId) clearTimeout(hoverTimeoutId);
                    setHoverTimeoutId(setTimeout(() => {
                        setHovered(false)
                    }, 600));
                }}
            >
                <div className={styles.content}>
                    <Link scroll={false} href={`/${num}`} className={styles.text_section} onMouseEnter={() => {
                        setHovered(isPlaying);
                        if (hoverTimeoutId) clearTimeout(hoverTimeoutId);
                    }}>
                        {active && <span className={styles.episode_number}>{`episode ${num}`}</span>}
                        <span className={styles.guest_name}>{title.split(/\s(-|–)\s?/g)[0].trim()}</span>
                    </Link>
                    <div className={styles.progress_bar_section}>
                        {audio && audio.src && audio.duration ? (
                            <>
                                <Slider
                                    min={0}
                                    max={audio.duration}
                                    value={progress}
                                    step={0.1}
                                    styles={{
                                        rail: railStyle,
                                        handle: handleStyle,
                                        track: trackStyle
                                    }}
                                    keyboard={false}
                                    onChange={(value) => {
                                        const val = (typeof value === "number" ? value : value[0]);
                                        audio.currentTime = val;
                                        setProgress(val);
                                    }}
                                />
                                <span className={styles.media_timestamp}>{formattedProgress}</span>
                                <span className={styles.media_duration}>{formattedDuration}</span>
                            </>
                        ) : null}
                    </div>
                    <div className={styles.separator} style={{ imageRendering: "pixelated", fill: "black", opacity: 1 }} />
                    <div className={styles.end_section}>
                        {
                            active && (status < 3 ? (<MaterialSpinningLoader />) :
                                (<div className={styles.playButton} style={{ imageRendering: "pixelated" }}
                                    onClick={() => {
                                        setPlaying((playing) => !playing);
                                    }}>
                                    <svg className={[styles.playButton_svg, isPlaying ? styles.playing : styles.paused].join(" ")}>
                                        <line x1="0%" y1="93%" x2="0%" y2="7%" className={[styles.playButtonBar, styles.playButtonBar_left].join(" ")} strokeLinecap="round" />
                                        <line x1="1%" y1="6%" x2="65%" y2="50%" className={[styles.playButtonBar, styles.playButtonBar_top].join(" ")} strokeLinecap="round" />
                                        <line x1="1%" y1="94%" x2="65%" y2="50%" className={[styles.playButtonBar, styles.playButtonBar_bottom].join(" ")} strokeLinecap="round" />
                                    </svg>
                                </div>)
                            )
                        }
                    </div>
                </div>
            </div>
            {showAudioElement && <audio />}
        </>
    );

};

const formatTime = (progress: number) => {
    const hours = Math.floor(progress / 3600);
    const minutes = Math.floor((progress - 3600 * hours) / 60);
    const seconds = Math.floor((progress - 3600 * hours - minutes * 60));
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default Controls;
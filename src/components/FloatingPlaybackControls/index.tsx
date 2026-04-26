

import React, { useCallback, useEffect, useState } from 'react';
import Slider from 'rc-slider';
import Link from 'next/link'
import dynamic from 'next/dynamic';

import { usePlayback, hackAutoplay } from '../../utils/PlayerContext';

import 'rc-slider/assets/index.css';
import styles from "./controls.module.css";


const railStyle = {
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: "8px"
};

const trackStyle = {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: "8px" 
};

const handleStyle = {
    backgroundColor: "rgba(0, 0, 0, 1)",
    border: "none",
    display: "none"
};

const MaterialSpinningLoader = dynamic(() => import("../MaterialSpinningLoader"));

const Controls = () => {

    const [hovered, setHovered] = useState(false);
    const [hoverTimeoutId, setHoverTimeoutId] = useState<NodeJS.Timeout | undefined>(undefined);
    const [progress, setProgress] = useState(0.0);
    const [showAudioElement, setShowAudioElement] = useState(false);

    const { playingEpisode, audio, setPlaying, isPlaying, status } = usePlayback();

    const active = !!playingEpisode?.mp3 && !!playingEpisode?.num && !!playingEpisode?.title;

    const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.keyCode == 32) {
            setPlaying(playing => !playing);
            e.preventDefault();
        }
    };

    useEffect(() => {
        // Detect iOS client-side so the check never runs during static export.
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
        setShowAudioElement(isIOS);
    }, []);

    useEffect(() => {
        // Same inline iOS check — avoids a module-scope navigator read.
        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
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

        const playstateCallback = () => {
            if (audio) setPlaying(audio?.paused === false);
        };

        progressCallback();

        (audio as HTMLAudioElement).addEventListener("timeupdate", progressCallback, { passive: true });
        (audio as HTMLAudioElement).addEventListener("play", playstateCallback, { passive: true });
        (audio as HTMLAudioElement).addEventListener("pause", playstateCallback, { passive: true });

        return () => {
            (audio as HTMLAudioElement).removeEventListener("timeupdate", progressCallback);
            (audio as HTMLAudioElement).removeEventListener("play", playstateCallback);
            (audio as HTMLAudioElement).removeEventListener("pause", playstateCallback);
        }
    }, [audio, audio?.paused, setPlaying]);

    let formattedProgress = "", formattedDuration = "";
    if (audio?.duration) {
        formattedProgress = formatTime(progress || 0);
        formattedDuration = formatTime(audio.duration);
    }

    const expandPlayer=() => {
        setHovered(isPlaying);
        if (hoverTimeoutId) clearTimeout(hoverTimeoutId);
    };

    return (
        <>
            <div className={[styles.frame, active ? styles.active : styles.hidden, hovered && status >= 3 ? styles.hovered : ""].join(" ")} tabIndex={0} onKeyDown={handleKeyPress}
                onMouseLeave={() => {
                    if (hoverTimeoutId) clearTimeout(hoverTimeoutId);
                    setHoverTimeoutId(setTimeout(() => {
                        setHovered(false)
                    }, 5000));
                }}
            >
                <div className={styles.content}>
                    <Link scroll={false} href={`/${playingEpisode?.num}`} className={styles.text_section} onMouseEnter={() => {
                        setHovered(isPlaying);
                        if (hoverTimeoutId) clearTimeout(hoverTimeoutId);
                    }}>
                        {active && <span className={styles.episode_number}>{`episode ${playingEpisode?.num}`}</span>}
                        <span className={styles.guest_name}>{playingEpisode?.title.split(/\s(-|–)\s?/g)[0].trim()}</span>
                    </Link>
                    <div className={styles.progress_bar_section} onMouseEnter={expandPlayer}>
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
                    { audio ? <VolumeControls audio={audio} onMouseEnter={expandPlayer} /> : null}
                    <div className={styles.separator} style={{ imageRendering: "pixelated", opacity: 1 }} />
                    <div className={styles.end_section} onClick={() => {
                        if (status >= 3 && active) setPlaying((playing) => !playing);
                    }}>
                        {
                            active && (status < 3 ? (<MaterialSpinningLoader />) :
                                (<div className={styles.playButton} style={{ imageRendering: "pixelated" }}>
                                    <svg className={[styles.playButton_svg, isPlaying ? styles.playing : styles.paused].join(" ")}>
                                        <line x1="0%" y1="95%" x2="0%" y2="2.5%" className={[styles.playButtonBar, styles.playButtonBar_left].join(" ")} strokeLinecap="round" />
                                        <line x1="1%" y1="0%" x2="65%" y2="45%" className={[styles.playButtonBar, styles.playButtonBar_top].join(" ")} strokeLinecap="round" />
                                        <line x1="1%" y1="97.5%" x2="65%" y2="52.5%" className={[styles.playButtonBar, styles.playButtonBar_bottom].join(" ")} strokeLinecap="round" />
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

const VolumeControls = ({ audio, onMouseEnter }: { audio: HTMLAudioElement, onMouseEnter: () => void }) => {
    const [volume, setVolume] = useState(localStorage.getItem("volume") ? parseFloat(localStorage.getItem("volume") || "1.0") : 1.0);
    const [muted, setMuted] = useState(localStorage.getItem("muted") === "true");
    const [showSlider, setShowSlider] = useState(false);
    const [clipSlider, setClipSlider] = useState(true);

    useEffect(() => {
        if (audio && (audio.volume !== volume || audio.muted !== muted)) {
            audio.volume = volume;
            audio.muted = muted;
        }
    }, [audio, volume, muted]);

    const volumeChangeCallback = useCallback(() => {
        setVolume(audio.volume);
        setMuted(audio.muted)
        localStorage.setItem("volume", String(audio.volume));
        localStorage.setItem("muted", String(audio.muted));
    }, [audio]);

    useEffect(() => {
        if (audio) {
            audio.addEventListener("volumechange", volumeChangeCallback, { passive: true });
            return () => {
                audio.removeEventListener("volumechange", volumeChangeCallback);
            }
        }
    }, [audio, volumeChangeCallback]);

    const handleMuteToggle = () => {
        if (volume < 0.01 && !muted) {
            setVolume(1);
            return;
        }
        setMuted((muted) => !muted);
    };

    const handleVolumeChange = (value: number | number[]) => {
        console.log(value);
        const val = (typeof value === "number" ? value : value[0]);
        if (val > 0.01) setMuted(false);
        setVolume(val);
    };

    return (
        <div
            className={[styles.volume_section, clipSlider ? styles.slider_clipped : ""].join(" ")}
            onMouseLeave={() => {
                setShowSlider(false)
                setTimeout(() => setClipSlider(true), 300);
            }}
            onMouseEnter={() => {
                setClipSlider(false);
                setShowSlider(true);
                onMouseEnter();
            }}
        >
            { /* eslint-disable-next-line @next/next/no-img-element */ }
            <img
                src={`/img/${muted || volume < 0.01 ? "muted" : (volume >= 0.5 ? "volume_high" : "volume_low")}.svg`}
                alt=""
                onClick={handleMuteToggle}
            />
            <div className={[styles.volume_slider, showSlider ? "" : styles.volume_slider_hidden].join(" ")}>
                <Slider
                    min={0}
                    max={1}
                    value={muted ? 0.0 : volume}
                    step={0.01}
                    styles={{
                        rail: railStyle,
                        handle: handleStyle,
                        track: trackStyle
                    }}
                    vertical
                    keyboard={false}
                    onChange={(val) => handleVolumeChange(val)}
                />
            </div>
        </div>
    );
}

const formatTime = (progress: number) => {
    const hours = Math.floor(progress / 3600);
    const minutes = Math.floor((progress - 3600 * hours) / 60);
    const seconds = Math.floor((progress - 3600 * hours - minutes * 60));
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default Controls;
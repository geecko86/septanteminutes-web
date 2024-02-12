'use client'

import React, { useContext, createContext, SetStateAction, useState, useEffect, useRef } from "react";
import loader from "../utils/cdn_img_loader";
import type { episode } from "../types/episode";
import { isIOS } from "react-device-detect";

const PlayerContext = createContext<PlaybackContextData | undefined>(undefined);

export const hackAutoplay = async (audio: HTMLAudioElement) => {
    if (audio && !audio.src) {
        audio.muted = false;
        audio.src = "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQMSkAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
        // audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        await audio.play();
    }
};

const setupMetadata = (playbackData: { playbackTitle: string, playbackArtwork: string }) => {
    if ('metadata' in navigator.mediaSession && playbackData.playbackArtwork) {
        navigator.mediaSession.metadata = new MediaMetadata(playbackData.playbackTitle ? {
            title: playbackData.playbackTitle,
            artist: 'Guillaume Hachez',
            album: 'Septante Minutes Avec',
            artwork: playbackData.playbackArtwork ? [
                { src: loader({ src: playbackData.playbackArtwork, width: 512, quality: 85 }), sizes: '512x512', type: 'image/png' }
            ] : []
        } : {});
        console.log("metadata set", playbackData.playbackArtwork, playbackData.playbackTitle);
    }
};

const updatePositionState = (audio: HTMLAudioElement) => {
    if ('setPositionState' in navigator.mediaSession) {
        navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate,
            position: audio.currentTime,
        });
    }
};

const setupPlaySession = (newAudio: HTMLAudioElement, setPlaying: (arg0: SetStateAction<boolean>) => void) => {
    const actionHandlers = [
        [
            "play",
            async () => {
                setPlaying(true);
                navigator.mediaSession.playbackState = "playing";
                updatePositionState(newAudio);
            },
        ],
        [
            "pause",
            (_: MediaSessionActionDetails) => {
                setPlaying(false);
                navigator.mediaSession.playbackState = "paused";
                updatePositionState(newAudio);
            },
        ],
        [
            "seekbackward",
            (details: MediaSessionActionDetails) => {
                const skipTime = details.seekOffset || 15;
                newAudio.currentTime = Math.max(0, newAudio.currentTime - skipTime);
                updatePositionState(newAudio);
            }
        ],
        [
            "seekforward",
            (details: MediaSessionActionDetails) => {
                const skipTime = details.seekOffset || 15;
                newAudio.currentTime = Math.min(newAudio.duration, newAudio.currentTime + skipTime);
                updatePositionState(newAudio);
            }
        ],
        [
            "seekto",
            (details: MediaSessionActionDetails) => {
                if (details.fastSeek && 'fastSeek' in newAudio) {
                    // Only use fast seek if supported.
                    newAudio.fastSeek(details.seekTime ?? 0);
                } else if (newAudio.currentTime && 'currentTime' in newAudio) {
                    newAudio.currentTime = details.seekTime ?? 0;
                }
                updatePositionState(newAudio);
            }
        ],
        // [
        //     "stop",
        //     (details: MediaSessionActionDetails) => {
        //         setPlaying(false);
        //         setMP3("");
        //         setPlaybackTitle("");
        //         newAudio.src = "";
        //         navigator.mediaSession.metadata = null;
        //         navigator.mediaSession.setPositionState(null as any);
        //     }
        // ]
    ];

    actionHandlers.forEach((actionHandler) => {
        navigator.mediaSession.setActionHandler(actionHandler[0] as any, actionHandler[1] as any);
    });

    // navigator.mediaSession.setActionHandler('previoustrack', function() { audio.load() });
    // navigator.mediaSession.setActionHandler('nexttrack', function() { audio.load() });
}

export const PlaybackProvider = ({ children }: PlaybackProviderProps) => {
    const [isPlaying, setPlaying] = useState(false)
    const [playbackMP3, setMP3] = useState("")
    const [playbackTitle, setPlaybackTitle] = useState("")
    const [playbackArtwork, setPlaybackArtwork] = useState("")
    const [playbackNum, setPlaybackNum] = useState<number>(0)
    const [status, setStatus] = useState<number>(0);
    const [autoPlay, setAutoplay] = useState<episode | undefined>(undefined);
    const audioRef = useRef<HTMLAudioElement>();
    const audio = audioRef.current;

    const onLoaded = () => {
        setStatus(audio?.readyState || 0)
        setPlaying(true);
    };
    const onEnded = () => {
        setMP3("");
        setPlaybackTitle("");
        setPlaybackArtwork("");
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    };

    const onError = (ev: Event) => {
        console.error(ev, audio?.src, playbackMP3);
        try {
            audio?.load();
        } catch (err) {
            console.error(err);
        }
    };

    const onPlay = () => {
        navigator.mediaSession.playbackState = 'playing';
    };

    const onPause = () => {
        navigator.mediaSession.playbackState = 'paused';
    };

    useEffect(() => {
        setupMetadata({
            playbackTitle,
            playbackArtwork,
        });
    }, [playbackArtwork]);

    useEffect(() => {
        if (audio) return;

        const newAudio = new Audio();
        newAudio.controls = false;
        newAudio.slot = "media";

        newAudio.addEventListener('play', onPlay);
        newAudio.addEventListener('pause', onPause);
        newAudio.addEventListener("canplay", onLoaded, { passive: true });
        newAudio.addEventListener("ended", onEnded, { passive: true });
        newAudio.addEventListener("error", onError, { passive: true });
        newAudio.addEventListener("canplay", onLoaded, { passive: true });

        audioRef.current = newAudio;

        return () => {
            console.log("audio removed")
            newAudio.removeEventListener("canplay", onLoaded);
            newAudio.removeEventListener("ended", onEnded);
            newAudio.removeEventListener("error", onError);
            newAudio.removeEventListener('play', onPlay);
            newAudio.removeEventListener('pause', onPause);
            audioRef.current = undefined;
        }
    }, []);

    useEffect(() => {
        if (playbackMP3 && audio && audio.src !== playbackMP3) {
            audio.src = playbackMP3;
            audio.load();
        }
    }, [playbackMP3, audio]);

    useEffect(() => {
        if (!audio) {
            if (isPlaying) setPlaying(false);
            return;
        } else {
            setStatus(audio?.readyState || 0);
        }

        if (isPlaying && audio.src && audio.readyState >= 2 && audio.canPlayType("audio/mpeg")) {
            audio.play().then(() => {
                    if (!audio.src.startsWith("data:audio")) {
                    setupMetadata({ playbackTitle, playbackArtwork });
                    setupPlaySession(audio, setPlaying);
                    updatePositionState(audio);
                }
            }).catch((err) => {
                console.error(err);
            });
        } else if (!audio.paused) {
            audio.pause();
        }
    }, [isPlaying, audio?.readyState]);

    const playbackData: PlaybackContextData = {
        isPlaying: isPlaying,
        setPlaying: setPlaying,
        playbackMP3: playbackMP3,
        setPlaybackMP3: setMP3,
        playbackTitle: playbackTitle,
        setPlaybackTitle: setPlaybackTitle,
        playbackArtwork: playbackArtwork,
        setPlaybackArtwork: setPlaybackArtwork,
        playbackNum: playbackNum,
        setPlaybackNum: setPlaybackNum,
        status: status,
        setStatus: setStatus,
        autoplay: autoPlay,
        setAutoplay: setAutoplay,
        audio: audio
    };

    return (
        <PlayerContext.Provider value={playbackData}>
            {children}
        </PlayerContext.Provider>
    );
}

export const usePlayback = () => {
    const context = useContext(PlayerContext)
    if (context === undefined) {
        throw new Error(`${usePlayback.name} must be within ${PlaybackProvider.name}`)
    }
    return context
}

export type PlaybackContextData = {
    isPlaying: boolean,
    setPlaying: (arg0: SetStateAction<boolean>) => void,
    playbackMP3: string,
    setPlaybackMP3: (arg0: SetStateAction<string>) => void,
    playbackNum: number,
    setPlaybackNum: (arg0: SetStateAction<number>) => void,
    playbackTitle: string,
    setPlaybackTitle: (arg0: SetStateAction<string>) => void,
    playbackArtwork: string,
    setPlaybackArtwork: (arg0: SetStateAction<string>) => void,
    status: number,
    setStatus: (arg0: SetStateAction<number>) => void,
    autoplay: episode | undefined,
    setAutoplay: (arg0: SetStateAction<episode | undefined>) => void,
    audio: HTMLAudioElement | undefined
}

type PlaybackProviderProps = {
    children: React.ReactNode
}
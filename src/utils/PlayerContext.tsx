

import React, { useContext, createContext, SetStateAction, useState, useEffect, useRef } from "react";
import loader from "../utils/cdn_img_loader";
import type { Episode } from "../types/episode";

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
    const [playingEpisode, setPlayingEpisode] = useState<Episode | undefined>(undefined)
    const [status, setStatus] = useState<number>(0);
    const [autoplay, setAutoplay] = useState<Episode | undefined>(undefined);
    const audioRef = useRef<HTMLAudioElement>();
    const audio = audioRef.current;

   useEffect(() => {
        if (navigator.mediaSession?.metadata?.title != playingEpisode?.title) {
            setupMetadata({
                playbackTitle: playingEpisode?.title!!,
                playbackArtwork : playingEpisode?.img!!,
            });
        }
    }, [playingEpisode]);

    useEffect(() => {
        if (audioRef.current) return;

        const newAudio = new Audio();
        newAudio.controls = false;
        newAudio.slot = "media";

        const onLoaded = () => {
            if (audioRef.current?.readyState) {
                setStatus(audioRef.current.readyState)
            }
            setPlaying(true);
        };
        const onEnded = () => {
            setPlayingEpisode(undefined)
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        };

        const onError = (ev: Event) => {
            console.error(ev, audioRef.current?.src);
            try {
                audioRef.current?.play();
            } catch (err) {
                if (err instanceof DOMException && audioRef.current?.src?.endsWith("mp3"))
                    audioRef.current?.load();
                else console.error(err);
            }
        };
    
        const onPlaying = () => {
            navigator.mediaSession.playbackState = 'playing';
            setStatus(4);
        };
    
        const onPause = () => {
            navigator.mediaSession.playbackState = 'paused';
        };
    
        const onWaiting = () => {
            setStatus(2);
        };

        newAudio.addEventListener('playing', onPlaying);
        newAudio.addEventListener('pause', onPause);
        newAudio.addEventListener("waiting", onWaiting, { passive: true });
        newAudio.addEventListener("canplay", onLoaded, { passive: true });
        newAudio.addEventListener("ended", onEnded, { passive: true });
        newAudio.addEventListener("error", onError, { passive: true });
        newAudio.addEventListener("seeked", onPlaying, { passive: true });

        audioRef.current = newAudio;
        (window as any).audioPlayer = audioRef;

        return () => {
            newAudio.removeEventListener('playing', onPlaying);
            newAudio.removeEventListener('pause', onPause);
            newAudio.removeEventListener("waiting", onWaiting);
            newAudio.removeEventListener("canplay", onLoaded);
            newAudio.removeEventListener("ended", onEnded);
            newAudio.removeEventListener("error", onError);
            newAudio.removeEventListener("seeked", onPlaying);
            audioRef.current = undefined;
            (window as any).audioPlayer = undefined;
        }
    }, []);

    useEffect(() => {
        if (playingEpisode?.mp3 && audio && audio.src !== playingEpisode.mp3) {
            audio.src = playingEpisode.mp3;
            audio.load();
        }
    }, [playingEpisode?.mp3, audio]);

    useEffect(() => {
        if (!audio) {
            if (isPlaying) setPlaying(false);
            return;
        }

        if (isPlaying && audio.src && audio.readyState >= 2 && audio.canPlayType("audio/mpeg")) {
            audio.play().then(() => {
                if (!audio.src.startsWith("data:audio") && navigator.mediaSession?.metadata?.title != playingEpisode?.title) {
                    setupMetadata({ playbackTitle: playingEpisode?.title!!, playbackArtwork: playingEpisode?.img!! });
                    setupPlaySession(audio, setPlaying);
                    updatePositionState(audio);
                }
            }).catch((err) => {
                console.error(err);
            });
        } else if (!audio.paused) {
            audio.pause();
        }
    }, [isPlaying, audio, playingEpisode, audio?.readyState]);

    const playbackData: PlaybackContextData = {
        isPlaying: isPlaying,
        setPlaying: setPlaying,
        playingEpisode: playingEpisode,
        setPlayingEpisode : setPlayingEpisode,
        status: status,
        setStatus: setStatus,
        autoplay: autoplay,
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
    playingEpisode: Episode | undefined,
    setPlayingEpisode: (arg0: SetStateAction<Episode | undefined>) => void,
    status: number,
    setStatus: (arg0: SetStateAction<number>) => void,
    autoplay: Episode | undefined,
    setAutoplay: (arg0: SetStateAction<Episode | undefined>) => void,
    audio: HTMLAudioElement | undefined
}

type PlaybackProviderProps = {
    children: React.ReactNode
}
'use client'

import React, { useContext, createContext, SetStateAction, useState, useEffect, ReactElement } from "react";
import type { episode } from "../types/episode";

const PlayerContext = createContext<PlaybackContextData | undefined>(undefined);

export const PlaybackProvider = ({ children }: PlaybackProviderProps) => {
    const [isPlaying, setPlaying] = useState(false)
    const [playbackMP3, setMP3] = useState("")
    const [playbackTitle, setPlaybackTitle] = useState("")
    const [playbackNum, setPlaybackNum] = useState<number>(0)
    const [status, setStatus] = useState<number>(0);
    const [autoPlay, setAutoplay] = useState<episode | undefined>(undefined);

    const [audio, setAudio] = useState<undefined | HTMLAudioElement>(undefined);

    const onLoaded = () => {
        setStatus(audio?.readyState || 0)
        setPlaying(true);
    };
    const onEnded = () => {
        setMP3("");
        setPlaybackTitle("");
        setAudio(undefined);
    };

    const stop = () => {
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    };

    useEffect(() => {
        if (playbackMP3) {
            const newAudio = new Audio(playbackMP3);
            newAudio.controls = false;
            newAudio.slot = "media";
            newAudio.addEventListener("canplay", onLoaded, { passive: true });
            newAudio.addEventListener("ended", onEnded, { passive: true });
            newAudio.addEventListener("error", (ev) => {
                console.error(ev, playbackMP3);
                try {
                    newAudio.load();
                } catch (err) {
                    console.error(err);
                }
            }, { passive: true });
            stop();
            setAudio(newAudio);

            return () => {
                newAudio.removeEventListener("canplay", onLoaded);
                newAudio.removeEventListener("ended", onEnded);
            }
        }
    }, [playbackMP3, setAudio]);

    useEffect(() => {
        if (!audio) {
            if (isPlaying) setPlaying(false);
            return;
        } else {
            setStatus(audio?.readyState || 0);
        }

        if (isPlaying && audio.readyState >= 2) {
            audio.play();
        } else audio.pause();
    }, [isPlaying, audio?.readyState]);

    const playbackData: PlaybackContextData = {
        isPlaying: isPlaying,
        setPlaying: setPlaying,
        playbackMP3: playbackMP3,
        setPlaybackMP3: setMP3,
        playbackTitle: playbackTitle,
        setPlaybackTitle: setPlaybackTitle,
        playbackNum: playbackNum,
        setPlaybackNum: setPlaybackNum,
        status: status,
        setStatus: setStatus,
        autoplay: autoPlay,
        setAutoplay: setAutoplay,
        audio: audio
    };

    return (
        <PlayerContext.Provider value={ playbackData }>
          { children }
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
    status: number,
    setStatus: (arg0: SetStateAction<number>) => void,
    autoplay: episode | undefined,
    setAutoplay: (arg0: SetStateAction<episode | undefined>) => void,
    audio: HTMLAudioElement | undefined
}

type PlaybackProviderProps = {
    children: React.ReactNode
}
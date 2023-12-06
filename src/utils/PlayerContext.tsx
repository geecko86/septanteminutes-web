'use client'

import React, { useContext, createContext, SetStateAction, useState, useEffect, ReactElement } from "react";

const PlayerContext = createContext<PlaybackContextData | undefined>(undefined);

export const PlaybackProvider = ({ children }: PlaybackProviderProps) => {
    const [isPlaying, setPlaying] = useState(false)
    const [playbackMP3, setMP3] = useState("")
    const [playbackTitle, setPlaybackTitle] = useState("")
    const [playbackNum, setPlaybackNum] = useState<number>(0)

    const [audio, setAudio] = useState<undefined | HTMLAudioElement>(undefined);

    useEffect(() => {
        if (playbackMP3 && audio?.src !== playbackMP3) {
            const newAudio = new Audio(playbackMP3);
            newAudio.controls = false;
            newAudio.slot = "media";
            const onLoaded = () => {
                setPlaying(true);
            };
            const onEnded = () => {
                setMP3("");
                setPlaybackTitle("");
                setAudio(undefined);
                newAudio.removeEventListener("ended", onEnded);
                newAudio.removeEventListener("canplay", onLoaded);
            };
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
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
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
        }

        if (isPlaying) {
            if (audio.readyState >= 2) audio.play();
        } else audio.pause();
    }, [isPlaying]);

    const playbackData: PlaybackContextData = {
        isPlaying: isPlaying,
        setPlaying: setPlaying,
        playbackMP3: playbackMP3,
        setPlaybackMP3: setMP3,
        playbackTitle: playbackTitle,
        setPlaybackTitle: setPlaybackTitle,
        playbackNum: playbackNum,
        setPlaybackNum: setPlaybackNum,
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
    audio: HTMLAudioElement | undefined
}

type PlaybackProviderProps = {
    children: React.ReactNode
}
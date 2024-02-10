'use client'

import React, { useContext, createContext, SetStateAction, useState, useEffect, ReactElement } from "react";
import loader from "../utils/cdn_img_loader";
import type { episode } from "../types/episode";

const PlayerContext = createContext<PlaybackContextData | undefined>(undefined);

const setupMetadata = (playbackData: {playbackTitle: string, playbackArtwork: string}) => {
    if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
            title: playbackData.playbackTitle,
            artist: 'Guillaume Hachez',
            album: 'Septante Minutes Avec',
            artwork: [
                { src: loader({src: playbackData.playbackArtwork, width: 96, quality: 75}),   sizes: '96x96',   type: 'image/png' },
                { src: loader({src: playbackData.playbackArtwork, width: 128, quality: 75}), sizes: '128x128', type: 'image/png' },
                { src: loader({src: playbackData.playbackArtwork, width: 192, quality: 75}), sizes: '192x192', type: 'image/png' },
                { src: loader({src: playbackData.playbackArtwork, width: 256, quality: 75}), sizes: '256x256', type: 'image/png' },
                { src: loader({src: playbackData.playbackArtwork, width: 384, quality: 75}), sizes: '384x384', type: 'image/png' },
                { src: loader({src: playbackData.playbackArtwork, width: 512, quality: 75}), sizes: '512x512', type: 'image/png' },
            ]
        });
    }
}

export const PlaybackProvider = ({ children }: PlaybackProviderProps) => {
    const [isPlaying, setPlaying] = useState(false)
    const [playbackMP3, setMP3] = useState("")
    const [playbackTitle, setPlaybackTitle] = useState("")
    const [playbackArtwork, setPlaybackArtwork] = useState("")
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

            setupMetadata({
                playbackTitle,
                playbackArtwork,
            })
    
            navigator.mediaSession.setActionHandler('play', () => {
                setPlaying(true)
            });
            navigator.mediaSession.setActionHandler('pause', () => {
                setPlaying(false)
            });
            navigator.mediaSession.setActionHandler('seekbackward', () => { newAudio.currentTime -= 15 });
            navigator.mediaSession.setActionHandler('seekforward', () => { newAudio.currentTime += 15 });
            // navigator.mediaSession.setActionHandler('previoustrack', function() {});
            // navigator.mediaSession.setActionHandler('nexttrack', function() {});

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
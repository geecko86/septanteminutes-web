import React, { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

export const getEpisodeNum = (asPath: string) => {
    let episodeNum = ''
    try {
        if (asPath && asPath.includes("#")) {
            const split = asPath.split('#');
            episodeNum = split[1];
        }
    } catch(err) {
    } finally {
        return episodeNum;
    }
}

function ScrollToAnchor(props: { id?: string, move: ((x: number) => void) | null }) {
    const { asPath, replace } = useRouter();
    const lastHash = useRef('');
    const { move } = props;

    useEffect(() => {
        lastHash.current = getEpisodeNum(asPath);
        if (!lastHash.current || !move) return;

        const action = () => {
            const id = `art_${lastHash.current}`;

            if (lastHash.current && document.getElementById(id)) {
                const element = document.getElementById(id);
                const { x, width } = element?.getBoundingClientRect() || { x: 0, width: 0 };
                const smallerDim = Math.min(window.innerWidth, window.innerHeight);
                const target = Math.max(Math.floor(x - (smallerDim / 2) + (width / 2)), 0);
                if (width > 0 && target > width) move(target);
                lastHash.current = '';
                replace("/", undefined, { scroll: false, shallow: true });
            }
        }

        if ("requestIdleCallback" in window) {
            const callbackId = requestIdleCallback(action);
            return () => {
                cancelIdleCallback(callbackId);
            }
        } else {
            const callbackId = requestAnimationFrame(action);
            return () => {
                cancelAnimationFrame(callbackId);
            }
        }
    }, [asPath, move, replace]);

    return (<div id={props.id} />);
}

export default ScrollToAnchor;

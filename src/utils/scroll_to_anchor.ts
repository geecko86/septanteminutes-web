import { useEffect, useRef } from 'react';
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

function ScrollToAnchor(props: { move: (x: number) => void }) {
    const { asPath, replace } = useRouter();
    const lastHash = useRef('');
    const { move } = props;

    useEffect(() => {
        lastHash.current = getEpisodeNum(asPath);
        if (!lastHash.current) return;

        const action = () => {
            const id = `art_${lastHash.current}`;

            if (lastHash.current && document.getElementById(id)) {
                const element = document.getElementById(id);
                const { x, width } = element?.getBoundingClientRect() || { x: 0, width: 0 };
                const target = Math.floor(Math.max(x - window.innerWidth / 2 + width / 2, 0));
                if (width > 0 && target > width) move(target);
                lastHash.current = '';
                replace("/", undefined, { scroll: false, shallow: true });
            }
        }

        if ("requestIdleCallback" in window) {
            const id = requestIdleCallback(action);
            return () => {
                cancelIdleCallback(id);
            }
        } else {
            const id = requestAnimationFrame(action);
            return () => {
                cancelAnimationFrame(id);
            }
        }
    }, [asPath, move]);

    return null;
}

export default ScrollToAnchor;

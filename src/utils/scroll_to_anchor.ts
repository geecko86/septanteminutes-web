import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { replaceState } from "history-throttled";

function ScrollToAnchor(props: { move: (x: number) => void }) {
    const { asPath } = useRouter();
    const lastHash = useRef('');
    const { move } = props;

    useEffect(() => {
        if (asPath && asPath.includes("#")) {
            lastHash.current = asPath.split('#')[1];
        } else return;

        const action = () => {
            const id = `art_${lastHash.current}`;

            if (lastHash.current && document.getElementById(id)) {
                const element = document.getElementById(id);
                const { x } = element?.getBoundingClientRect() || { x: 0 };
                const target = Math.max(x - window.innerWidth / 2, 0);
                if (target > 0) move(target);
                lastHash.current = '';
                replaceState({ path: "/" }, "", "/");
            }
        }

        if ("requestIdleCallback" in window) {
            const id = requestIdleCallback(action);
            return () => {
                cancelIdleCallback(id);
            }
        } else {
            const id = setTimeout(action, 450);
            return () => {
                clearTimeout(id);
            }
        }
    }, [asPath, move]);

    return null;
}

export default ScrollToAnchor;

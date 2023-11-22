import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

function ScrollToAnchor(props: { move: (x: number) => void }) {
    const { asPath } = useRouter();
    const lastHash = useRef('');
    const { move } = props;

    useEffect(() => {
        if (asPath && asPath.includes("#")) {
            lastHash.current = asPath.split('#')[1];
        }

        setTimeout(() => {
            const id = `art_${lastHash.current}`;

            if (lastHash.current && document.getElementById(id)) {
                const element = document.getElementById(id);
                const { x } = element?.getBoundingClientRect() || { x: 0 };
                move(x - window.innerWidth / 2);
                lastHash.current = '';
            }
        }, 450);
    }, [asPath, move]);

    return null;
}

export default ScrollToAnchor;

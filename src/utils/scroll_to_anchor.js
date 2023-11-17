import { useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

function ScrollToAnchor() {
    const { asPath } = useRouter();
    const lastHash = useRef('');

  // listen to location change using useEffect with location as dependency
  // https://jasonwatmore.com/react-router-v6-listen-to-location-route-change-without-history-listen
  useEffect(() => {
    if (asPath && asPath.includes("#")) {
        lastHash.current = asPath.split('#')[1];
    }
    
    setTimeout(() => {
        const id = `art_${lastHash.current}`;

        if (lastHash.current && document.getElementById(id)) {
            const { x } = document
            .getElementById(id)
            .getBoundingClientRect();
            window.scrollBy({
                top: x - (window.innerWidth / 2),
                behavior: "instant"
            });
            console.log(id, document.getElementById(id));
            console.log(lastHash.current, "scrollBy", x);
            lastHash.current = '';
            }
      }, 450);
  }, [asPath]);

  return null;
}

export default ScrollToAnchor;

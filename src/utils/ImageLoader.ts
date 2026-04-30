import { useEffect, useState } from 'react';

/**
 * Hook that returns true once the image at `src` has fully loaded.
 * Uses a temporary off-screen Image element to track the network request
 * without rendering anything in the DOM.
 */
const useImageLoader = (src: string): boolean => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => setLoaded(true);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: synchronous fast-path for already-cached images
    if (img.complete) setLoaded(true);
  }, [src]);

  return loaded;
};

export default useImageLoader;

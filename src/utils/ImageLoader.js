import { useEffect, useState } from 'react';

const useImageLoader = (src) => {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => setLoaded(true);
    if (img.complete) setLoaded(true)
  }, [src]);

  return loaded;
};

export default useImageLoader;
import { useState, useEffect } from 'react';

export function useMobileDevice(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(
      window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0
    );
  }, []);
  return isMobile;
}

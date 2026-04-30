import { useState, useEffect } from 'react';

export function useMobileDevice(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: SSR-safe one-shot browser capability detection on mount
    setIsMobile(
      window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0
    );
  }, []);
  return isMobile;
}

import { MotionValue, useTransform } from "framer-motion";
import { RefObject, useEffect, useCallback, useState } from "react";
import { isMobile } from "react-device-detect";

const useOffset = (ref: RefObject<HTMLDivElement>, motionValue: MotionValue, coeff: number = 130, pow: number = 1.0, src: string = "", onReady?: () => void, jumpToValue?: (val: number | string) => void) => {

  const [windowDim, setWindowDim] = useState({ width: 0, height: 0 });
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    const subroot: HTMLDivElement | undefined = document.getElementById("subroot") as HTMLDivElement;

    const handleResize = () => {
      const parentWidth = subroot?.parentElement?.clientWidth || 0;
      const width = subroot?.clientHeight === parentWidth ? window.innerHeight : window.innerWidth;
      const height = subroot?.clientHeight === parentWidth ? window.innerWidth : window.innerHeight;
      setWindowDim({ width, height });
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    setIsMobileDevice(isMobile);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const computeTranslationX = useCallback(() => {
    const target = ref.current;
    if (!target) return "0px";
    const isRotated = window.innerHeight !== windowDim.height;
    const viewportEnd = windowDim.width;
    const targetRect = target.getBoundingClientRect();

    // Calculate the horizontal position of the target element
    const targetStart = isRotated ? targetRect.top : targetRect.left;
    const targetWidth = isRotated ? targetRect.height : targetRect.width;
    const targetEnd = targetRect.right + motionValue.get();

    // if (targetStart > 0 && targetStart < 1000 && src==="https://framerusercontent.com/images/p7a4OJaiiEBm2LbB08atc4nEjM.png") console.log(targetStart, viewportEnd);
    if (targetStart > windowDim.width) { 
      // if (src === "https://framerusercontent.com/images/hxRiihE2Zoimhej95EBT69kprc.png") console.log(targetStart, "-aaa-")
      return `0px`;
    }

    const adjustedCoeff = coeff * (isMobileDevice ? (windowDim.width / windowDim.height) : (16/9));
    // Calculate the progress percentage
    const newProgress =
      ((viewportEnd - targetStart) / (viewportEnd + Math.max(targetRect.width, targetRect.height)));
    if (newProgress >= 1.6) {
      return `${adjustedCoeff * -0.0153}px`;
    }

    const output = `${(adjustedCoeff > 0 ? 1 : -1) * targetWidth * (Math.pow(newProgress * Math.abs(adjustedCoeff), pow) / 100)}px`;
    // const output = `${newProgress * adjustedCoeff}%`;
    return output;
  }, [ref, motionValue, coeff, isMobileDevice, pow, windowDim]);

  useEffect(() => {
    // Define limit
    const limit = (document.getElementById("home")?.clientWidth || windowDim.width) - windowDim.width;
    let onReadyMutationObserver: MutationObserver, limitMutationObserver: MutationObserver, onReadyTimeoutId: NodeJS.Timeout;

    if (onReady && ref.current) {
      // Create a MutationObserver
      onReadyMutationObserver = new MutationObserver(() => {
        onReady();
        onReadyMutationObserver.disconnect();
      });
      // Observe changes in attributes and subtree (which includes position changes)
      onReadyMutationObserver.observe(ref.current, { attributes: true, subtree: true });
      onReadyTimeoutId = setTimeout(onReady, 500);
    }

    if (jumpToValue && limit && ref.current) {
      const position = Array.prototype.indexOf.call(ref.current.parentElement?.childNodes, ref.current) - ref.current.parentElement?.childNodes.length!!;
      if (position >= -2) {
        limitMutationObserver = new MutationObserver(t => {
          if (motionValue.get() <= -(limit - 10)) {
            jumpToValue(computeTranslationX());
            requestAnimationFrame(() => {
              jumpToValue(computeTranslationX());
            });
          }
        });
        limitMutationObserver.observe(ref.current, { attributes: true, subtree: true });
      }
    }

    // Cleanup MutationObserver on component unmount
    return () => {
      onReadyMutationObserver?.disconnect();
      limitMutationObserver?.disconnect();
      if (onReadyTimeoutId) clearTimeout(onReadyTimeoutId);
    };
  }, [onReady, jumpToValue, windowDim.width, motionValue, ref, computeTranslationX]);

  return useTransform(computeTranslationX);
}

export default useOffset;

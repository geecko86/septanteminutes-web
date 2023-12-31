import { MotionValue, motion, useTransform } from "framer-motion";
import { RefObject, useEffect } from "react";

export default (ref: RefObject<HTMLDivElement>, motionValue: MotionValue, coeff: number = 130, src: string = "", onReady?: () => void) => {

  const updateTranslationX = () => {
    const target = ref.current;
    if (!target) return "0%";

    const viewportEnd = window.innerWidth;
    const targetRect = target.getBoundingClientRect();

    // Calculate the horizontal position of the target element
    const targetStart = targetRect.left;
    const targetEnd = targetRect.right + motionValue.get();

    // if (targetStart > 0 && targetStart < 1000 && src==="https://framerusercontent.com/images/p7a4OJaiiEBm2LbB08atc4nEjM.png") console.log(targetStart, viewportEnd);
    if (targetStart > window.innerWidth) { 
      // if (src === "https://framerusercontent.com/images/hxRiihE2Zoimhej95EBT69kprc.png") console.log(targetStart, "-aaa-")
      return `0%`;
    }
    if (targetRect.right < -targetRect.width) return `${coeff * 1.22}%`;


    // Calculate the progress percentage
    const newProgress =
      ((viewportEnd - targetStart) / (viewportEnd + targetRect.width));

    const output = `${coeff * newProgress}%`;

    // if (src === "https://framerusercontent.com/images/hxRiihE2Zoimhej95EBT69kprc.png") console.log(targetStart, output);

    return output;
  };

  useEffect(() => {
    if (onReady) {
      // Create a MutationObserver
      const mutationObserver = new MutationObserver(() => {
        onReady();
        mutationObserver.disconnect();
      });
      setTimeout(() => {
        onReady();
        mutationObserver.disconnect();
      }, 500)
      
      // Observe changes in attributes and subtree (which includes position changes)
      if (ref.current) {
        mutationObserver.observe(ref.current, { attributes: true, subtree: true });
      }
      
      // Cleanup MutationObserver on component unmount
      return () => {
        mutationObserver.disconnect();
      };
    }
  }, []);

  return useTransform(updateTranslationX);
}
/* eslint-disable import/no-anonymous-default-export */
import { MotionValue, useTransform } from "framer-motion";
import { RefObject, useEffect, useState } from "react";

export default (ref: RefObject<HTMLDivElement>, motionValue: MotionValue, coeff: number = 130, pow: number = 1.0, src: string = "", onReady?: () => void, jumpToValue?: (val: number | string) => void) => {

  const computeTranslationX = () => {
    const target = ref.current;
    if (!target) return "0%";

    const viewportEnd = window.innerWidth;
    const targetRect = target.getBoundingClientRect();

    // Calculate the horizontal position of the target element
    const targetStart = targetRect.left;
    const targetEnd = targetRect.right + motionValue.get();

    const adjustedCoeff = coeff * (window.innerWidth / window.innerHeight) ;
    const adjustedPow = window.innerHeight > window.innerWidth ? pow : 1.0;

    // if (targetStart > 0 && targetStart < 1000 && src==="https://framerusercontent.com/images/p7a4OJaiiEBm2LbB08atc4nEjM.png") console.log(targetStart, viewportEnd);
    if (targetStart > window.innerWidth) { 
      // if (src === "https://framerusercontent.com/images/hxRiihE2Zoimhej95EBT69kprc.png") console.log(targetStart, "-aaa-")
      return `0%`;
    }
    if (targetRect.right < -3 * targetRect.width) {
      return `${adjustedCoeff * -1.53}%`;
    }



    // Calculate the progress percentage
    const newProgress =
      ((viewportEnd - targetStart) / (viewportEnd + Math.max(targetRect.width, targetRect.height)));

    const output = `${Math.pow(newProgress * adjustedCoeff, adjustedPow)}%`;
    return output;
  };

  useEffect(() => {
    // Define limit
    const limit = (document.getElementById("home")?.clientWidth || window.innerWidth) - window.innerWidth;
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
  }, []);

  return useTransform(computeTranslationX);
}
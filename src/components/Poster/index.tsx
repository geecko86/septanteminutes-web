import React, { RefObject, useRef } from "react";
import { MotionValue, motion } from "framer-motion";
import Image from "next/image";
import useOffset from  "../../utils/ParallaxOffset";
import { isIOS } from "react-device-detect";

const Poster = (props: PosterProps) => {

    const { motionValue, poster: { src, ratio, parallaxFactor }, onReady, isLast, inheritedRef, ...newProps } = props;
    const ref = useRef<HTMLDivElement>(inheritedRef?.current || null);

    let translateX: MotionValue | string;
    const jumpToValue = isLast ? (val: number | string) => {
        if (translateX && typeof(translateX) !== "string") translateX.jump(val);
    } : undefined;

    // eslint-disable-next-line react-hooks/rules-of-hooks
    translateX = isIOS ? "55%" : useOffset(ref, motionValue, parallaxFactor || 130, 1.0, src, onReady, jumpToValue);

    return (<div {...newProps} ref={ref}>
        <motion.div style={{ position: "relative", translateX, translateZ: "0px", height: "100%", width: "100%" }}>
          <Image alt="" src={props.poster.src} quality={50} sizes={`${Math.floor(30 * ratio)}svmin`} fill />
        </motion.div>
    </div>);
};

export default Poster

type PosterProps = {
    className: string,
    motionValue: MotionValue,
    onReady?: () => void,
    inheritedRef?: RefObject<HTMLDivElement>,
    isLast?: boolean,
    poster: {
        src: string,
        ratio: number,
        parallaxFactor?: number | undefined
    }
}
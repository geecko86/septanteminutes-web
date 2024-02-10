import React, { RefObject, useRef } from "react";
import { MotionValue, motion } from "framer-motion";
import Image from "next/image";
import useOffset from  "../../utils/ParallaxOffset";

const Poster = (props: PosterProps) => {

    const { motionValue, poster: { src, ratio, parallaxFactor }, onReady, isLast, inheritedRef, ...newProps } = props;
    const ref = useRef<HTMLDivElement>(inheritedRef?.current || null);

    let translateX: MotionValue;
    const jumpToValue = isLast ? (val: number | string) => {
        if (translateX) translateX.jump(val);
    } : undefined;
    translateX = useOffset(ref, motionValue, parallaxFactor || 130, 1.0, src, onReady, jumpToValue);

    return (<div {...newProps} ref={ref}>
        <motion.div style={{ position: "relative", translateX, height: "100%", width: "100%" }}>
          <Image alt="" src={props.poster.src} quality={50} sizes={`${Math.floor(40 * ratio)}vh`} fill />
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
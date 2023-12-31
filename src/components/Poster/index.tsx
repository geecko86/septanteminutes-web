import React, { useRef } from "react";
import { MotionValue, motion } from "framer-motion";
import Image from "next/image";
import useOffset from  "../../utils/ParallaxOffset";

const Poster = (props: PosterProps) => {

    const ref = useRef<HTMLDivElement>(null);

    const { motionValue, poster: { src, ratio, parallaxFactor }, onReady, ...newProps } = props;
    const translateX = useOffset(ref, motionValue, parallaxFactor || 160, src, onReady);

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
    poster: {
        src: string,
        ratio: number,
        parallaxFactor?: number | undefined
    }
}
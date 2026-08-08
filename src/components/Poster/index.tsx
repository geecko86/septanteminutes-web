import React, { useRef, useMemo, useEffect } from "react";
import { MotionValue, motion, useTransform } from "framer-motion";
import Image from "next/image";
import useOffset from  "../../utils/ParallaxOffset";
import isOldPhone from "../../utils/mobileChecker";
import styles from "./poster.module.css";

const PosterComponentOldPhone = React.forwardRef<HTMLImageElement, PosterProps>((props, ref) => {
    const { motionValue, priority, setFirstPosterMotionValue, position, poster: { src, ratio, height }, offset, onReady, isLast, initialScene, ...newProps } = props;

    const parentRef = useRef<HTMLDivElement>(null);
    const home = document.getElementById("home");

    // const translateX = useMemo(() => `${55+5*position}%`, [position]);
    const translateX = useTransform(motionValue, (value) => {
        const numerator = value + offset * 0.9;
        return `${-Math.abs(numerator / (home?.clientWidth || 3000) * 5 * (parentRef.current?.clientWidth || 0))}px`;
    });
    const size = useMemo(() => `${Math.floor(height * 80 * (ratio < 1 ? ratio : 1))}vh`, [height, ratio]);
    const style = useMemo(() => ({ height: `${height * 100}%`, width: "auto", aspectRatio: ratio, left: `calc(${position} * var(--layer_1_gap) + ${offset}px + (var(--layer_1_gap) / 2)` }), [height, ratio, offset, position]);

    useEffect(() => {
        if (position == 0 && setFirstPosterMotionValue) setFirstPosterMotionValue(translateX);
    }, [position, setFirstPosterMotionValue, translateX]);

    // TODO: size when landscape rotation
    return (<div {...newProps} style={style} ref={parentRef}>
        <motion.div style={{ position: "relative", translateX, translateZ: "0px", height: "100%", width: "100%" }}>
          <Image draggable="false" data-initial-scene={initialScene ? "true" : undefined} alt="" priority={priority} ref={ref} src={src} quality={50} sizes={size} fill />
        </motion.div>
    </div>);
});
PosterComponentOldPhone.displayName = 'PosterComponentOldPhone';

const PosterComponentNewDevice = React.forwardRef<HTMLImageElement, PosterProps>((props, ref) => {
    const { motionValue, priority, setFirstPosterMotionValue, position, poster: { src, ratio, height, parallaxFactor, leftOffset }, onReady, offset, isLast, initialScene, ...newProps } = props;

    const jumpToValue = (val: number | string) => {
        if (!isLast && typeof(val) === "string") {
            translateX.jump(val);
        }
    };
    const newRef = useRef<HTMLDivElement>(null);

    const translateX = useOffset(newRef, motionValue, (parallaxFactor || 130) / 2.7, 1.0, src, onReady, jumpToValue);
    const size = useMemo(() => `${Math.floor(height * 65 * (ratio < 1 ? ratio : 1))}vh`, [height, ratio]);
    const style = useMemo(() => ({ height: `${height * 100}%`, width: "auto", aspectRatio: ratio, left: `calc(${position} * var(--layer_1_gap) + ${offset}px - ${((leftOffset || 0.0)) * 100}%)` }), [height, ratio, offset, position, leftOffset]);

    useEffect(() => {
        if (position == 0 && setFirstPosterMotionValue) setFirstPosterMotionValue(translateX);
    }, [position, setFirstPosterMotionValue, translateX]);

    // TODO: size when landscape rotation
    return (<div {...newProps} ref={newRef} style={style}>
        <motion.div style={{ position: "relative", translateX, translateZ: "0px", height: "100%", width: "100%" }}>
          <Image draggable="false" data-initial-scene={initialScene ? "true" : undefined} alt="" priority={priority} ref={ref} src={props.poster.src} quality={50} sizes={size} fill />
        </motion.div>
    </div>);
});
PosterComponentNewDevice.displayName = 'PosterComponentNewDevice';

const PosterComponent = React.forwardRef((props: PosterProps, ref: React.ForwardedRef<HTMLImageElement>) => {
    const [isOldDevice, setIsOldDevice] = React.useState(false);

    useEffect(() => {
        setIsOldDevice(isOldPhone());
    }, []);

    return isOldDevice ? (<PosterComponentOldPhone {...props} />) : (<PosterComponentNewDevice ref={ref} {...props} />);
});

PosterComponent.displayName = 'PosterComponent';
const Poster = React.memo(PosterComponent);
Poster.displayName = 'Poster';

const posters = [
    { src: "https://framerusercontent.com/images/XRJGfu2ZZn2mWSL86QVmPhAfBE.jpg", className: styles.leuven, height: 0.5, ratio: 440 / 228, parallaxFactor: 100 },
    { src: "https://framerusercontent.com/images/iiwPEYtcgqr0GlVsNBXYW7X8.jpg", className: styles.akerman, height: 0.5, ratio: 337 / 296, parallaxFactor: 140 },
    { src: "https://framerusercontent.com/images/HSI69fi5yZ7EAlWBALNdz3stGI.jpg", className: styles.brel, height: 0.67, ratio: 337 / 448, parallaxFactor: 170 },
    { src: "https://framerusercontent.com/images/onpDPhhlUWDWDTFRwQ8urTPOXQs.jpg", className: styles.redford, height: 0.6, ratio: 582 / 397, parallaxFactor: 100 },
    { src: "https://framerusercontent.com/images/vLmtQT4GleFmn9TgKABXXI9xNC8.jpg", className: styles.cavell, height: 0.52, ratio: 2267 / 1704, parallaxFactor: 110 },
    { src: "https://framerusercontent.com/images/smcypGnQ7zED6TKSxE9PpqKBMxQ.jpg", className: styles.congo, height: 0.67, ratio: 2267 / 1704, parallaxFactor: 130, leftOffset: 0.01 },
    { src: "https://framerusercontent.com/images/WiTE1wYTrGK2zx2OVVRi5QGnFg.jpg", className: styles.walenbuiten, height: 0.6, ratio: 2267 / 1704, parallaxFactor: 130 },
    { src: "https://framerusercontent.com/images/8euSsKe0GIbfmDH50p4BA8Enozw.jpg", className: styles.stones, ratio: 1, height: 0.67, parallaxFactor: 140 },
];

export default Poster;
export { posters };

type PosterProps = {
    className: string,
    motionValue: MotionValue,
    offset: number,
    priority: boolean,
    onReady?: () => void,
    setFirstPosterMotionValue: (val: MotionValue) => void,
    isLast?: boolean,
    initialScene?: boolean,
    position: number,
    poster: {
        src: string,
        height: number,
        ratio: number,
        leftOffset?: number,
        parallaxFactor?: number
    }
};

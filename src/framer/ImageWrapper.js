;

import React, { useRef, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

import useOffset from "../utils/ParallaxOffset";
import { useTransform } from "framer-motion";
import isOldPhone from "@/utils/mobileChecker";

const ImageOffsetWrapperComponentOldPhone = (props) => {
    const { position, motionValue, style, priority, offset, offsetFactor, loading, src, sizes, quality, fetchPriority, initialScene, ...newProps } = props;

    const translateX = useTransform(motionValue, (value) => {
        const numerator = value;
        return `-${numerator / (home?.clientWidth || 3000) * 500}%`; // TODO: why 500? Should use clientwidth
    });

    return (<div {...newProps}>
        <motion.div style={{ ...style, position: "relative", translateX: offset || translateX, translateZ: "4px", height: "100%", width: "100%" }}>
            <Image draggable="false" data-initial-scene={initialScene ? "true" : undefined} src={src} alt="" fill loading={priority ? "eager" : "lazy"} priority={!!priority} fetchPriority={fetchPriority} quality={quality} sizes={sizes || "10vw"} />
        </motion.div>
    </div>)
};

const ImageOffsetWrapperComponentNewDevice = (props) => {
    const { motionValue, src, offsetFactor, onReady, priority, offset, sizes, loading, style, quality, fetchPriority, initialScene, ...newProps } = props;
    const ref = useRef(null);

    const translateX = useOffset(ref, motionValue, offsetFactor || 30, 0.9515, src, onReady);

    return (<div {...newProps} ref={ref}>
        <motion.div style={{ ...style, position: "relative", translateX: translateX, translateZ: "4px", height: "100%", width: "100%" }}>
            <Image draggable="false" data-initial-scene={initialScene ? "true" : undefined} src={src} alt="" fill loading={priority ? "eager" : "lazy"} priority={!!priority} fetchPriority={fetchPriority} quality={quality} sizes={sizes || "10vw"} />
        </motion.div>
    </div>)
};

const ImageOffsetWrapperComponent = (props) => {
    if (isOldPhone()) {
        return <ImageOffsetWrapperComponentOldPhone {...props} />;
    } else {
        return <ImageOffsetWrapperComponentNewDevice {...props} />;
    }
};

const ImageOffsetWrapper = React.memo(ImageOffsetWrapperComponent);
ImageOffsetWrapper.displayName = 'ImageOffsetWrapper';

const ImageWrapperComponent = (props) => {
    const { src, sizes, priority, onReady, style, blurDataURL, loading, quality, fetchPriority, initialScene, ...otherProps } = props;

    const placeholder = useMemo(() => {
        return !!blurDataURL ? "blur" : "empty";
    }, [blurDataURL]);

    return (<motion.div {...otherProps} style={{ transform: "translateZ(4px)", ...style }} >
        <Image draggable="false" data-initial-scene={initialScene ? "true" : undefined} src={src} blurDataURL={blurDataURL} loading={priority ? "eager" : "lazy"} priority={!!priority} fetchPriority={fetchPriority} quality={quality} placeholder={placeholder} alt="" fill sizes={sizes || "10vw"} />
    </motion.div>)
};

const ImageWrapper = React.memo(ImageWrapperComponent);
ImageWrapper.displayName = 'ImageWrapper';

export { ImageOffsetWrapper, ImageWrapper };

export const Headphones = (props) => {
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/images/79iKMvZpOdjB4LrQS90DE0i4o.webp" sizes="30vh" />);
    return { ...comp, displayName: "Headphones" };
};

export const Needle = (props) => {
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/images/1cQdpjDMVfIHwcDhe6q9QrIAY.webp" sizes="(max-width: 1200px) 33vw, 35vh" style={{
        filter: "drop-shadow(rgba(0, 0, 0, 0.33) 0px 1px 11px)"
    }} />);
    return { ...comp, displayName: "Needle" };
};

export const BellLamp = (props) => {
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/images/SM7LQLK7ePLJSfc9sOkU4yxHdo.png" sizes="30vh" />);
    return { ...comp, displayName: "BellLamp" };
}

export const Chair = (props) => {
    // Read touch capability at render time on the client only.
    // ImageWrapper.js is always used inside dynamic(() => ..., { ssr: false })
    // or in components that only render client-side, so typeof window is safe here.
    const isMobileDevice = typeof window !== "undefined" &&
        (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
    const comp = (<ImageWrapper sizes={isMobileDevice ? "25vh" : "50vh"} quality={60} {...props} priority={!isMobileDevice} src="https://framerusercontent.com/images/1rnV14P8MhyhWjPOrSeUNIVvs.png" />);
    return { ...comp, displayName: "Chair" };
};

export const HomeChair = (props) => {
    const comp = (<ImageOffsetWrapper offsetFactor={-70} sizes="30vh" {...props} src={props.src} />);
    return { ...comp, displayName: "HomeChair" };
};

export const Pen = (props) => {
    const comp = (<ImageWrapper sizes="30vh" {...props} priority={false} src="https://framerusercontent.com/assets/Fx6XFRFwE2EscXTGW81QBWrLYEs.webp" />);
    return { ...comp, displayName: "Pen" };
};

export const Vinyl_Base = (props) => {
    const comp = (<ImageWrapper sizes="(pointer:coarse) and (orientation: portrait) 25vw, 30vh" {...props} src="https://framerusercontent.com/images/FagAAtLngco0ruyleiYmdGuaE8.webp" />);
    return { ...comp, displayName: "VinylBase" };
}

export const Plant0 = (props) => {
    const comp = (<ImageOffsetWrapper sizes="28vh" {...props} src="https://framerusercontent.com/images/8Ggkp82i4KDOti6OlNeYv09tjo.png" />);
    return { ...comp, displayName: "Plant0" };
};

export const Plant1 = (props) => { // Spark
    const comp = (<ImageOffsetWrapper sizes="28vh" {...props} src="https://framerusercontent.com/images/v09nOPANtVA3uqTzDVhjvhIjCQ.webp" />);
    return { ...comp, displayName: "Plant1" };
};

export const Plant2 = (props) => { // Frontblur
    const blurData = "data:image/webp;base64,UklGRrIAAABXRUJQVlA4WAoAAAAQAAAACwAACwAAQUxQSGIAAAABcFNt27I8v0w2ueCyOoRg9AYEsCgcAvjGIQSbOwX+DKz6vh0iYgIAQO3WZNB653api1Ry/XqvDCq/fb+vVar4fL83acrqLfdDmQLMnALeU8ALMVfkstNJliuEYYEzxyPjD1ZQOCAqAAAAcAEAnQEqDAAMAASAciWMAsOxQAAA/u+D828D/voCs31SOwVm+SZ8AAAA";
    const comp = (<ImageWrapper sizes={"25vh"} placeholder="blur" blurDataURL={blurData} {...props} priority src="https://framerusercontent.com/images/lFUB6zkoI3fsnsa3UYKcdXQVhE.png" />);
    return { ...comp, displayName: "Plant2" };
};

export const Plant3 = (props) => { // Round
    const comp = (<ImageOffsetWrapper sizes="28vh" {...props} src="https://framerusercontent.com/images/BgdYnNcvVP57exwmV2MFEN7SLo.png" />);
    return { ...comp, displayName: "Plant3" };
};

export const Plant4 = (props) => { // Boring
    const comp = (<ImageOffsetWrapper sizes="28vh" {...props} src="https://framerusercontent.com/images/s4BQ4aoKoI1rJPyHChPCxzxdk.png" />);
    return { ...comp, displayName: "Plant4" };
};

export const Eggchair = (props) => {
    const comp = (<ImageOffsetWrapper sizes="28vh" {...props} src="https://framerusercontent.com/images/7QvFPqG25dfwCQYgiY5quD5Tc.webp" />);
    return { ...comp, displayName: "Eggchair" };
};

export const BackwallLight = (props) => {
    const { offset, ...newProps } = props;
    const comp = (<ImageWrapper {...newProps} style={{translateX: offset || 0}} priority={true} loading="eager" src="https://framerusercontent.com/images/nrc6Kp2HXcr2ppbsl4XQtHFx0tY.png" sizes="92vh" />);
    return { ...comp, displayName: "BackwallLight" };
}

import React, { useMemo, useRef } from "react";
import Image from "next/image";
import { motion, useTransform } from "framer-motion";

import useOffset from "../../utils/ParallaxOffset";
import isOldPhone from "../../utils/mobileChecker";

const OldPhoneOffsetImage = (props) => {
    const { position, motionValue, style, priority, offset, offsetFactor, loading, src, sizes, quality, fetchPriority, initialScene, ...containerProps } = props;
    const translateX = useTransform(motionValue, (value) =>
        `-${value / (document.getElementById("home")?.clientWidth || 3000) * 500}%`
    );

    return <div {...containerProps}>
        <motion.div style={{ ...style, position: "relative", translateX: offset || translateX, translateZ: "4px", height: "100%", width: "100%" }}>
            <Image draggable="false" data-initial-scene={initialScene ? "true" : undefined} src={src} alt="" fill loading={priority ? "eager" : "lazy"} priority={!!priority} fetchPriority={fetchPriority} quality={quality} sizes={sizes || "10vw"} />
        </motion.div>
    </div>;
};

const ModernOffsetImage = (props) => {
    const { position, motionValue, src, offsetFactor, onReady, priority, offset, sizes, loading, style, quality, fetchPriority, initialScene, ...containerProps } = props;
    const ref = useRef(null);
    const translateX = useOffset(ref, motionValue, offsetFactor || 30, 0.9515, src, onReady);

    return <div {...containerProps} ref={ref}>
        <motion.div style={{ ...style, position: "relative", translateX, translateZ: "4px", height: "100%", width: "100%" }}>
            <Image draggable="false" data-initial-scene={initialScene ? "true" : undefined} src={src} alt="" fill loading={priority ? "eager" : "lazy"} priority={!!priority} fetchPriority={fetchPriority} quality={quality} sizes={sizes || "10vw"} />
        </motion.div>
    </div>;
};

const ImageOffsetWrapperComponent = (props) =>
    isOldPhone() ? <OldPhoneOffsetImage {...props} /> : <ModernOffsetImage {...props} />;

export const ImageOffsetWrapper = React.memo(ImageOffsetWrapperComponent);
ImageOffsetWrapper.displayName = "ImageOffsetWrapper";

const ImageWrapperComponent = (props) => {
    const { src, sizes, priority, onReady, style, blurDataURL, loading, quality, fetchPriority, initialScene, ...containerProps } = props;
    const placeholder = useMemo(() => blurDataURL ? "blur" : "empty", [blurDataURL]);

    return <motion.div {...containerProps} style={{ transform: "translateZ(4px)", ...style }}>
        <Image draggable="false" data-initial-scene={initialScene ? "true" : undefined} src={src} blurDataURL={blurDataURL} loading={priority ? "eager" : "lazy"} priority={!!priority} fetchPriority={fetchPriority} quality={quality} placeholder={placeholder} alt="" fill sizes={sizes || "10vw"} />
    </motion.div>;
};

export const ImageWrapper = React.memo(ImageWrapperComponent);
ImageWrapper.displayName = "ImageWrapper";

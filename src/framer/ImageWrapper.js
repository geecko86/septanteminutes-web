;

import React, { useRef, useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

import useOffset from "../utils/ParallaxOffset";
import { useTransform } from "framer-motion";
import isOldPhone from "@/utils/mobileChecker";
import { isMobile } from "react-device-detect";

const ImageOffsetWrapperComponentOldPhone = (props) => {
    const { position, motionValue, style, priority, offset, offsetFactor, loading, src, sizes, ...newProps } = props;

    const translateX = useTransform(motionValue, (value) => {
        const numerator = value;
        return `-${numerator / (home?.clientWidth || 3000) * 500}%`; // TODO: why 500? Should use clientwidth
    });

    return (<div {...newProps}>
        <motion.div style={{ ...style, position: "relative", translateX: offset || translateX, translateZ: "4px", height: "100%", width: "100%" }}>
            <Image draggable="false" src={src} alt="" fill priority={!!priority} sizes={sizes || "10vw"} />
        </motion.div>
    </div>)
};

const ImageOffsetWrapperComponentNewDevice = (props) => {
    const { motionValue, src, offsetFactor, onReady, priority, offset, sizes, loading, style, ...newProps } = props;
    const ref = useRef(null);

    const translateX = useOffset(ref, motionValue, offsetFactor || 30, 0.9515, src, onReady);

    return (<div {...newProps} ref={ref}>
        <motion.div style={{ ...style, position: "relative", translateX: translateX || translateX, translateZ: "4px", height: "100%", width: "100%" }}>
            <Image draggable="false" prior src={src} alt="" fill priority={!!priority} sizes={sizes || "10vw"} />
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
    const { src, sizes, priority, onReady, style, blurDataURL, ...otherProps } = props;

    const placeholder = useMemo(() => {
        return !!blurDataURL ? "blur" : "empty";
    }, [blurDataURL]);

    return (<motion.div {...otherProps} style={{ transform: "translateZ(4px)", ...style }} >
        <Image draggable="false" src={src} blurDataURL={blurDataURL} placeholder={placeholder} alt="" fill sizes={sizes || "10vw"} />
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
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/images/1cQdpjDMVfIHwcDhe6q9QrIAY.webp" sizes="35vh" style={{
        filter: "drop-shadow(rgba(0, 0, 0, 0.33) 0px 1px 11px)"
    }} />);
    return { ...comp, displayName: "Needle" };
};

export const BellLamp = (props) => {
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/images/SM7LQLK7ePLJSfc9sOkU4yxHdo.png" sizes="30vh" />);
    return { ...comp, displayName: "BellLamp" };
}

export const Chair = (props) => {
    const comp = (<ImageWrapper sizes="50vh" {...props} priority={true} src="https://framerusercontent.com/images/1rnV14P8MhyhWjPOrSeUNIVvs.png" />);
    return { ...comp, displayName: "Chair" };
};

export const HomeChair = (props) => {
    const comp = (<ImageOffsetWrapper offsetFactor={-70} sizes="30vh" {...props} src={props.src} />);
    return { ...comp, displayName: "HomeChair" };
};

export const Pen = (props) => {
    const comp = (<ImageWrapper sizes="30vh" {...props} src="https://framerusercontent.com/assets/Fx6XFRFwE2EscXTGW81QBWrLYEs.webp" />);
    return { ...comp, displayName: "Pen" };
};

export const Vinyl_Base = (props) => {
    const comp = (<ImageWrapper sizes="30vh" {...props} src="https://framerusercontent.com/images/FagAAtLngco0ruyleiYmdGuaE8.webp" />);
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
    const blurData = "data:image/webp;base64,UklGRnIEAABXRUJQVlA4WAoAAAAwAAAAFwAAFwAASUNDUKACAAAAAAKgbGNtcwRAAABtbnRyUkdCIFhZWiAH6AACABEAFQAxABBhY3NwQVBQTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWxjbXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1kZXNjAAABIAAAAEBjcHJ0AAABYAAAADZ3dHB0AAABmAAAABRjaGFkAAABrAAAACxyWFlaAAAB2AAAABRiWFlaAAAB7AAAABRnWFlaAAACAAAAABRyVFJDAAACFAAAACBnVFJDAAACFAAAACBiVFJDAAACFAAAACBjaHJtAAACNAAAACRkbW5kAAACWAAAACRkbWRkAAACfAAAACRtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACQAAAAcAEcASQBNAFAAIABiAHUAaQBsAHQALQBpAG4AIABzAFIARwBCbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABQAHUAYgBsAGkAYwAgAEQAbwBtAGEAaQBuAABYWVogAAAAAAAA9tYAAQAAAADTLXNmMzIAAAAAAAEMQgAABd7///MlAAAHkwAA/ZD///uh///9ogAAA9wAAMBuWFlaIAAAAAAAAG+gAAA49QAAA5BYWVogAAAAAAAAJJ8AAA+EAAC2xFhZWiAAAAAAAABilwAAt4cAABjZcGFyYQAAAAAAAwAAAAJmZgAA8qcAAA1ZAAAT0AAACltjaHJtAAAAAAADAAAAAKPXAABUfAAATM0AAJmaAAAmZwAAD1xtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAEcASQBNAFBtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJBTFBIzgAAAAGAZG3b8eZNatu2R9bMxg5sa2pjlNMN2B5lB12DbbsNn/p7lxARE0D/NAkI1CFOx+ZNmTNLmFxxOZVvIGTe1r2r/VAseojoFCzsb2uhvBgzEZCYDp4qAMV9t7MAWU0cAsDjuqdAYOuZ5ofmvs/ifxLHDfw6lmD5PyqR/zakQ4Jh0y/ABz4qhcglKlrWoWg2IXEJmSck6xGrnS8xJ+px5epyhbpxBdjzeDWOjjR6caSdKz7O0zgyboHbDI6YHWAnhsNmCViy4TCIra0K1/sHVlA4INYAAADwBQCdASoYABgAPjEUiEKiISEYDAQAIAMEsoBdioAXZzvIX+9IqwL/XkVF94bwk7ehSXnOxsySgAD+/qAXhOAqsbk2ZQvFBGBmeHCrxM/dU6Avlzn9of/2vkuyoH1SYA1wWjBVrbHzg0wTywMRIJTNDjNsD/ozgtz6TJv+PIT9079dAbmB+DPYTSZaJo8jX7P++wla91Y+6jc70y0GHr5B+Fu+P4lhpvNE9r3YBn3KvsdZZSY8Qtjy571c5s8/3/gf5G5ckj8m0FVghO2e4tgO9/ExgAAA";
    const comp = (<ImageWrapper sizes={"89vmin"} placeholder="blur" blurDataURL={blurData} {...props} src="https://framerusercontent.com/images/lFUB6zkoI3fsnsa3UYKcdXQVhE.png" />);
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
    const comp = (<ImageWrapper {...newProps} style={{translateX: offset}} priority={true} loading="eager" src="https://framerusercontent.com/images/t2tJdWNxSdl6oaN7xXaM0a9RHz4.png" sizes="250vh" />);
    return { ...comp, displayName: "BackwallLight" };
}
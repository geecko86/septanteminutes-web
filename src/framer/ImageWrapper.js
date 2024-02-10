'use client';

import React, { useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

import useOffset from  "../utils/ParallaxOffset";

const ImageOffsetWrapper = (props) => {
    const { motionValue, src, sizes, onReady, offsetFactor, targetRef, ...newProps } = props;
    const ref = useRef(targetRef?.current || null);

    let translateX;
    const jumpToValue = (val) => {
        if (translateX) translateX.jump(val);
    };
    translateX = useOffset(props.targetRef || ref, motionValue, offsetFactor || 150, 0.9515, src, onReady, jumpToValue);

    return (<div {...newProps} ref={ref}>
        <motion.div style={{ position: "relative", translateX, height: "100%", width: "100%" }}>
            <Image src={src} alt="" fill sizes={sizes || "10vw"} />
        </motion.div>
    </div>)
};

const ImageWrapper = (props) => (
    <div {...props} >
        <Image src={props.src} alt="" fill sizes={props.sizes || "10vw"} />
    </div>
);

export const Headphones = (props) => {
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/images/79iKMvZpOdjB4LrQS90DE0i4o.webp" sizes="30svh" />);
    return {...comp, displayName: "Headphones"};
};

export const BellLamp = (props) => {
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/images/SM7LQLK7ePLJSfc9sOkU4yxHdo.png" sizes="30svh" />);
    return {...comp, displayName: "BellLamp"};
}

export const Chair = (props) => {
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/images/1rnV14P8MhyhWjPOrSeUNIVvs.png" sizes="50svh" />);
    return {...comp, displayName: "Chair"};
};

export const Pen = (props) => {
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/assets/Fx6XFRFwE2EscXTGW81QBWrLYEs.webp" sizes="30svh" />);
    return {...comp, displayName: "Pen"};
};

export const Vinyl_Base = (props) => {
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/images/FagAAtLngco0ruyleiYmdGuaE8.webp" sizes="30svh" />);
    return {...comp, displayName: "VinylBase"};
}

export const Plant0 = (props) => {
    const comp = (<ImageOffsetWrapper {...props} src="https://framerusercontent.com/images/R8Kn20M0nzPmEcfud1mHzG8Uyk.png" sizes={props.sizes || "40vh"} />);
    return {...comp, displayName: "Plant0"};
};

export const Plant1 = (props) => {
    const comp = (<ImageOffsetWrapper {...props} src="https://framerusercontent.com/images/hxRiihE2Zoimhej95EBT69kprc.png" sizes={props.sizes || "40vh"} />);
    return {...comp, displayName: "Plant1"};
};

export const Plant2 = (props) => {
    const comp = (<ImageWrapper {...props} src="https://framerusercontent.com/images/lFUB6zkoI3fsnsa3UYKcdXQVhE.png" sizes={props.sizes || "50vw"} />);
    return {...comp, displayName: "Plant2"};
};

export const Plant3 = (props) => {
    const comp = (<ImageOffsetWrapper {...props} src="https://framerusercontent.com/images/1HpjPEOfsK4TSxEz6aRVR1QUmhs.png" sizes={props.sizes || "40vh"} />);
    return {...comp, displayName: "Plant3"};
};

export const Plant4 = (props) => {
    const comp = (<ImageOffsetWrapper {...props} src="https://framerusercontent.com/images/yhEIvU554Dvkhmnmw59O6yPu60.png" sizes={props.sizes || "40vh"} />);
    return {...comp, displayName: "Plant4"};
};

export const Eggchair = (props) => {
    const comp = (<ImageOffsetWrapper {...props} src="https://framerusercontent.com/images/p7a4OJaiiEBm2LbB08atc4nEjM.png" sizes={props.sizes || "40vh"} />);
    return {...comp, displayName: "Eggchair"};
};

export const BackwallLight = (props) => {
    const comp = (<ImageOffsetWrapper offsetFactor={20.1} {...props} src="https://framerusercontent.com/images/FsKB3GEHFAPqgBfbeEkGrIb6lA.png" sizes="461vw" />);
    return {...comp, displayName: "BackwallLight"};
}
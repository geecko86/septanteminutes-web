'use client';

import React, { useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

import useOffset from  "../utils/ParallaxOffset";

const ImageOffsetWrapper = (props) => {
    const { motionValue, src, sizes, priority, loading, onReady, offsetFactor, targetRef, ...newProps } = props;
    const ref = useRef(targetRef?.current || null);

    let translateX;
    const jumpToValue = (val) => {
        if (translateX) translateX.jump(val);
    };
    translateX = useOffset(props.targetRef || ref, motionValue, offsetFactor || 150, 0.9515, src, onReady, jumpToValue);

    return (<div {...newProps} ref={ref}>
        <motion.div style={{ position: "relative", translateX, height: "100%", width: "100%" }}>
            <Image src={src} alt="" fill priority={!!priority} loading={loading || "lazy"} sizes={sizes || "10vw"} />
        </motion.div>
    </div>)
};

const ImageWrapper = (props) => (
    <div {...props} >
        <Image src={props.src} alt="" fill sizes="10vw" />
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
    const comp = (<ImageWrapper sizes="50svh" {...props} src="https://framerusercontent.com/images/1rnV14P8MhyhWjPOrSeUNIVvs.png" />);
    return {...comp, displayName: "Chair"};
};

export const Pen = (props) => {
    const comp = (<ImageWrapper sizes="30svh" {...props} src="https://framerusercontent.com/assets/Fx6XFRFwE2EscXTGW81QBWrLYEs.webp" />);
    return {...comp, displayName: "Pen"};
};

export const Vinyl_Base = (props) => {
    const comp = (<ImageWrapper sizes="30svh" {...props} src="https://framerusercontent.com/images/FagAAtLngco0ruyleiYmdGuaE8.webp" />);
    return {...comp, displayName: "VinylBase"};
}

export const Plant0 = (props) => {
    const comp = (<ImageOffsetWrapper sizes="28svh" {...props} src="https://framerusercontent.com/images/R8Kn20M0nzPmEcfud1mHzG8Uyk.png" />);
    return {...comp, displayName: "Plant0"};
};

export const Plant1 = (props) => {
    const comp = (<ImageOffsetWrapper sizes="28svh" {...props} src="https://framerusercontent.com/images/hxRiihE2Zoimhej95EBT69kprc.png" />);
    return {...comp, displayName: "Plant1"};
};

export const Plant2 = (props) => {
    const blurData = "data:image/webp;base64,UklGRnIEAABXRUJQVlA4WAoAAAAwAAAAFwAAFwAASUNDUKACAAAAAAKgbGNtcwRAAABtbnRyUkdCIFhZWiAH6AACABEAFQAxABBhY3NwQVBQTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA9tYAAQAAAADTLWxjbXMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA1kZXNjAAABIAAAAEBjcHJ0AAABYAAAADZ3dHB0AAABmAAAABRjaGFkAAABrAAAACxyWFlaAAAB2AAAABRiWFlaAAAB7AAAABRnWFlaAAACAAAAABRyVFJDAAACFAAAACBnVFJDAAACFAAAACBiVFJDAAACFAAAACBjaHJtAAACNAAAACRkbW5kAAACWAAAACRkbWRkAAACfAAAACRtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACQAAAAcAEcASQBNAFAAIABiAHUAaQBsAHQALQBpAG4AIABzAFIARwBCbWx1YwAAAAAAAAABAAAADGVuVVMAAAAaAAAAHABQAHUAYgBsAGkAYwAgAEQAbwBtAGEAaQBuAABYWVogAAAAAAAA9tYAAQAAAADTLXNmMzIAAAAAAAEMQgAABd7///MlAAAHkwAA/ZD///uh///9ogAAA9wAAMBuWFlaIAAAAAAAAG+gAAA49QAAA5BYWVogAAAAAAAAJJ8AAA+EAAC2xFhZWiAAAAAAAABilwAAt4cAABjZcGFyYQAAAAAAAwAAAAJmZgAA8qcAAA1ZAAAT0AAACltjaHJtAAAAAAADAAAAAKPXAABUfAAATM0AAJmaAAAmZwAAD1xtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAEcASQBNAFBtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJBTFBIzgAAAAGAZG3b8eZNatu2R9bMxg5sa2pjlNMN2B5lB12DbbsNn/p7lxARE0D/NAkI1CFOx+ZNmTNLmFxxOZVvIGTe1r2r/VAseojoFCzsb2uhvBgzEZCYDp4qAMV9t7MAWU0cAsDjuqdAYOuZ5ofmvs/ifxLHDfw6lmD5PyqR/zakQ4Jh0y/ABz4qhcglKlrWoWg2IXEJmSck6xGrnS8xJ+px5epyhbpxBdjzeDWOjjR6caSdKz7O0zgyboHbDI6YHWAnhsNmCViy4TCIra0K1/sHVlA4INYAAADwBQCdASoYABgAPjEUiEKiISEYDAQAIAMEsoBdioAXZzvIX+9IqwL/XkVF94bwk7ehSXnOxsySgAD+/qAXhOAqsbk2ZQvFBGBmeHCrxM/dU6Avlzn9of/2vkuyoH1SYA1wWjBVrbHzg0wTywMRIJTNDjNsD/ozgtz6TJv+PIT9079dAbmB+DPYTSZaJo8jX7P++wla91Y+6jc70y0GHr5B+Fu+P4lhpvNE9r3YBn3KvsdZZSY8Qtjy571c5s8/3/gf5G5ckj8m0FVghO2e4tgO9/ExgAAA";
    const comp = (<ImageWrapper sizes={"89svmin"} placeholder="blur" blurDataURL={blurData} {...props} src="https://framerusercontent.com/images/lFUB6zkoI3fsnsa3UYKcdXQVhE.png" />);
    return {...comp, displayName: "Plant2"};
};

export const Plant3 = (props) => {
    const comp = (<ImageOffsetWrapper sizes="28svh" {...props} src="https://framerusercontent.com/images/1HpjPEOfsK4TSxEz6aRVR1QUmhs.png" />);
    return {...comp, displayName: "Plant3"};
};

export const Plant4 = (props) => {
    const comp = (<ImageOffsetWrapper sizes="28svh" {...props} src="https://framerusercontent.com/images/yhEIvU554Dvkhmnmw59O6yPu60.png" />);
    return {...comp, displayName: "Plant4"};
};

export const Eggchair = (props) => {
    const comp = (<ImageOffsetWrapper sizes="28svh" {...props} src="https://framerusercontent.com/images/p7a4OJaiiEBm2LbB08atc4nEjM.png" />);
    return {...comp, displayName: "Eggchair"};
};

export const BackwallLight = (props) => {
    const comp = (<ImageOffsetWrapper offsetFactor={20.1} {...props} priority={true} loading="eager" src="https://framerusercontent.com/images/FsKB3GEHFAPqgBfbeEkGrIb6lA.png" sizes="461vw" />);
    return {...comp, displayName: "BackwallLight"};
}
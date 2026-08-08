import React from "react";
import { ImageWrapper } from "./ImageBase";

const Chair = (props) => {
    const mobile = typeof window !== "undefined" && (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
    return <ImageWrapper sizes={mobile ? "25vh" : "50vh"} quality={60} {...props} priority={!mobile} src="https://framerusercontent.com/images/1rnV14P8MhyhWjPOrSeUNIVvs.png" />;
};
export default Chair;

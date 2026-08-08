import React from "react";
import { ImageWrapper } from "./ImageBase";

const BackwallLight = ({ offset, ...props }) => <ImageWrapper {...props} style={{ translateX: offset || 0 }} priority src="https://framerusercontent.com/images/nrc6Kp2HXcr2ppbsl4XQtHFx0tY.png" sizes="92vh" />;
export default BackwallLight;

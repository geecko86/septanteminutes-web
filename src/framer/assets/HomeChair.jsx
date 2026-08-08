import React from "react";
import { ImageOffsetWrapper } from "./ImageBase";

const HomeChair = (props) => <ImageOffsetWrapper offsetFactor={-70} sizes="30vh" {...props} src={props.src} />;
export default HomeChair;

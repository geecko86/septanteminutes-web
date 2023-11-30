'use client';

import React from "react";
import Image from "next/image"

const Plant3 = (props) => (
    <div {...props} >
        <Image alt="" src="https://framerusercontent.com/images/1HpjPEOfsK4TSxEz6aRVR1QUmhs.png" fill sizes={props.sizes || "10vw"} />
    </div>
)

Plant3.displayName = "Plant3";

export default Plant3;
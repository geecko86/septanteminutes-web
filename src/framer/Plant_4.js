'use client';

import React from "react";
import Image from "next/image"

const Plant4 = (props) => (
    <div {...props} >
        <Image alt="" src="https://framerusercontent.com/images/yhEIvU554Dvkhmnmw59O6yPu60.png" fill sizes={props.sizes || "10vw"} />
    </div>
)

Plant4.displayName = "Plant4";

export default Plant4;
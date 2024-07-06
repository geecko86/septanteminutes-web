

/* eslint-disable @next/next/no-img-element */
import React from "react";
import Head from 'next/head';
import Image from "next/image";

import Vinyl from "../../../public/img/vinyl_compressed.svg";
import Monogram from "../../../public/img/sma_monogram.svg";

const Loader = (props) => {
    return (
        <>
            <Head>
                <link rel="preload" href="/img/SMA_sleeve_256.webp" as="image" />
                <style>
                {`@keyframes moveDisk {from { transform:translateX(0); }  to { transform: translateX(30%); }}`}
                {`@keyframes moveSleeve { from {  transform: translateX(0); } to { transform: translateX(-30%); } }`}
                {`@keyframes rotateLogo { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }`}
                {`.vinyl_loading {
                    opacity: 1;
                    transition: opacity 0.2s cubic-bezier(0.39, 0.575, 0.565, 1);
                    transition-delay: 0.35s;
                    position: absolute;
                    height: 30vh;
                    width: 50vh;
                    display: flex;
                    align-items: center;
                }
                .vinyl_loading.vinyl_hidden {
                    opacity: 0 !important;
                    transition-delay: 0s;
                }`}
                </style>
            </Head>
            <div className={props.className} style={{
                placeSelf: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "54%",
                height: "54%"
            }}>
                <div style={{
                    width: "calc(min(30vh, 55vw))",
                    height: "calc(min(30vh, 55vw))",
                    transform: "translateX(0)",
                    position: "absolute",
                    animation: "moveDisk 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                }}>
                    <Image src={Vinyl} fill alt="vinyl_loading" unoptimized style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        filter: "drop-shadow(1vh 0.75vh 0.5vh rgba(0,0,0,0.3))"
                    }} />
                    <Image src={Monogram} alt="" unoptimized width={100} height={100} style={{
                        position: "absolute",
                        width: "26.6666%",
                        height: "26.6666%",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        animation: "rotateLogo 1.8s linear infinite"
                    }} />
                    <div style={{
                        width: "26.6666%",
                        height: "26.6666%",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        background: "#cccc",
                        clipPath: "circle(4% at center)",
                        position: "absolute"
                    }} />
                </div>
                <div style={{position: "absolute", height: "calc(min(30vh, 55vw) - 1px)", width: "auto", aspectRatio: 1, display: "flex", flexDirection: "column", zIndex: 5, animation: "moveSleeve 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
                    <Image src="/img/SMA_sleeve_256.webp" sizes="15vh" fill={true} loading="eager" priority alt="Loading box" style={{
                        overflow: "hidden",
                        boxShadow: "0.5vh 1vh 3vh rgba(0,0,0,0.3), -0.5vh 0px 3vh rgba(0,0,0,0.4)",                        
                    }} />
                </div>
            </div>
        </>
    )
};

export default Loader;
'use client'

import React from "react";
import Head from 'next/head';
import styled, { keyframes } from 'styled-components';

const Loader = (props) => {

    return (
        <>
            <Head>
                <link rel="preload" href="/img/SMA_sleeve.svg" as="image" />
                <style>
                {`@keyframes moveDisk {\nfrom { transform:scale(0.975) translateX(0) translateY(7.5%); }  to { transform:scale(0.975) translateX(33%) translateY(7.5%); }}\n`}
                {`@keyframes moveSleeve { from {  transform: translateX(0); } to { transform: translateX(-33%); } }\n`}
                {`@keyframes rotateLogo { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }`}
                </style>
            </Head>
            <div className={props.className} style={{
                position: "absolute",
                top: "35vh",
                left: "35vw"
            }}>
                <div style={{
                    width: "30vh",
                    height: "30vh",
                    transform: "scale(0.975) translateX(0) translateY(7.5%)",
                    position: "absolute",
                    animation: "moveDisk 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards"
                }}>
                    <img loading="eager" src="/img/vinyl.svg" alt="" style={{
                        width: "30vh",
                        height: "30vh",
                        position: "absolute",
                        filter: "drop-shadow(0px 15px 10px rgba(0,0,0,0.3))"
                    }} />
                    <img loading="eager" src="/img/sma_monogram.svg" alt="" style={{
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
                    }}></div>
                </div>
                <div style={{position: "absolute", height: "calc(30vh+40px)", display: "flex", flexDirection: "column", zIndex: 5, animation: "moveSleeve 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
                    <div style={{ height: "20px", width: "100%", background: "#0000" }} />
                    <div alt="sleeve_loading" style={{
                        width: "30vh",
                        height: "30vh",
                        overflow: "hidden",
                        background: "url(/img/SMA_sleeve.svg) no-repeat center bottom, #574e42",
                        backgroundSize: "107.66%",
                        backgroundPositionX: "56%",
                        backgroundPositionY: "50%",
                        boxShadow: "5px 10px 30px rgba(0,0,0,0.3), -5px 0px 30px rgba(0,0,0,0.4)",
                        clipPath: "inset(0px -30px -50px -30px)"
                    }} />
                    <div style={{ height: "20px", width: "100%", background: "white" }} />
                </div>
            </div>
        </>
    )
};

export default Loader;
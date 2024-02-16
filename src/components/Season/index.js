import React from "react";
import Image from "next/image";

import styles from "./season.module.css";

const Season = ({
    chair,
    seasonTitle,
    children,
    className,
    style,
    ...otherProps
}) => {
    return (
        <div {...otherProps} className={[styles.season, styles.season_inside, otherProps.className || ""].join(" ")} tabIndex={0} style={{ ...style, display: "contents" }}>
            <div className={[styles.season_inside, styles.index_season_frame, className].join(" ")} style={{
                backgroundColor: "rgb(233, 233, 233)",
                boxShadow: "rgba(0, 0, 0, 0.1) 0px 2px 0px 0px, rgba(0, 0, 0, 0.1) 0px -2px 0px 0px",
                opacity: 1,
                minWidth: chair ? "inherit" : "unset"
            }}>
                {!!chair && <div style={{
                    height: "100%",
                    width: "100%",
                    position: "absolute",
                    display: "flex",
                    overflow: "hidden"
                }}>
                    {
                        [...Array(Math.max(1, Math.ceil((children?.length || 2) / 2 / 3.3))).keys()].map((i) => (
                            <div key={`season_${seasonTitle}_texture_${i}`} style={{ height: "100%", width: "auto", aspectRatio: 3 / 2, position: "relative" }}>
                                <Image
                                    alt="" fill={true}
                                    priority={true}
                                    className={styles.wall} sizes="85svh"
                                    src="https://framerusercontent.com/images/hxXL2jKccfg84wL6UdchMdB312c.jpg"
                                    style={{
                                        position: "absolute",
                                        opacity: 0.32,
                                        transform: `scaleX(${i % 2 === 0 ? 1 : -1})`
                                    }}
                                />
                            </div>
                        ))
                    }
                </div>}
                <div data-framer-name="Wall" style={{
                    background: "linear-gradient(rgba(255, 255, 255, 0.3), rgba(190, 189, 189, 0.3))",
                    aspectRatio: true ? `max(665.17, 8.22 * 17.5 * ${Math.ceil((children?.length || 2) / 2)} + 8.22 * 7 * ${Math.ceil((children?.length || 2) / 2) - 1})/543` : "unset"
                }}>
                    <div className={styles.header} key={`season_header_${seasonTitle}`} data-framer-name="Header">
                        <div className={styles.header_logo} data-framer-name="Logo">
                            <Image
                                alt="Septante Minutes Avec" loading="lazy" fill={true}
                                className={styles.header_logo_img} sizes="128px"
                                src="https://framerusercontent.com/images/QokJTU8EgfetEJChRtQByxNfgTw.png"
                                style={{
                                    position: "absolute"
                                }}
                            />
                        </div>
                        <div data-framer-component-type="SVG" data-framer-name="Line 1" parentsize="0" rotation="0" shadows="" className={styles.svg_0} style={{ imageRendering: "pixelated", fill: "black", opacity: 1 }}>
                            <div className="svgContainer" style={{ width: "100%", height: "100%", aspectRatio: "inherit" }}>
                                <svg width="3" height="31" viewBox="-1 -1 3 31" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <line x1="0.5" y1="2.18557e-08" x2="0.499999" y2="29" stroke="black" />
                                </svg>
                            </div>
                        </div>
                        <div className={styles.season_title} data-framer-name="Frame 10" style={{ opacity: 1 }}><div className={styles.richtextcontainer0} data-framer-component-type="RichTextContainer" style={{ outline: "none", display: "flex", flexDirection: "column", justifyContent: "flex-start", "--framer-font-family": "Futura Condensed Extra", "--framer-font-weight": 700, "--framer-font-size": "2.37svh", paddingTop: "1px", transform: "none", opacity: 1 }}><p className="framer-text">{seasonTitle}</p></div>
                            <div className={styles.richtextcontainer1} data-framer-component-type="RichTextContainer" style={{ outline: "none", display: "flex", "flexDirection": "column", justifyContent: "flex-start", "--framer-paragraph-spacing": "0px", paddingBottom: "2px", transform: "none", opacity: 1 }}>
                                <p className="framer-text">
                                    <span className="framer-text" style={{ "--font-selector": "R0Y7UmFkd2F2ZS1yZWd1bGFy", "--framer-font-family": "Radwave Demo" }}>
                                        Présenté par Guillaume Hachez
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className={styles.albums_container} data-framer-name="Albums" style={{ opacity: 1 }}>
                        {children}
                    </div>
                    <div className={styles.season_legende} data-framer-name="LEGENDE" style={{ opacity: 1 }}>
                        <img src="/img/side_A.svg" alt="" />
                        <img src="/img/45_rpm.svg" alt="" />
                        <img src="/img/stereo.svg" alt="" />
                        <img src="/img/import.svg" alt="" />
                        <div className={styles.richtextcontainer2} data-framer-component-type="RichTextContainer" style={{ outline: "none", display: "flex", flexDirection: "column", justifyContent: "flex-start", "--framer-paragraph-spacing": "0px", transform: "none", opacity: 1 }}>
                            <p className="framer-text" style={{ "--font-selector": "R0Y7T3N3YWxkLTYwMA==", "--framer-font-family": "\"Oswald\", \"Oswald Placeholder\", sans-serif", "--framer-font-size": "4px", "--framer-font-weight": 600, "--framer-line-height": "3ch", "--framer-text-transform": "uppercase" }}>Disponible sur toutes</p>
                            <p className="framer-text" style={{ "--font-selector": "R0Y7T3N3YWxkLTYwMA==", "--framer-font-family": "\"Oswald\", \"Oswald Placeholder\", sans-serif", "--framer-font-size": "4px", "--framer-font-weight": 600, "--framer-line-height": "3ch", "--framer-text-transform": "uppercase" }}>les plateformes</p>
                        </div>
                    </div>
                </div>
                {chair ?
                    (<div className={styles.chair} data-framer-name="Chair">
                        <Image alt="" loading="lazy" className="chair_img" sizes="30vw" src={chair} fill={true} style={{
                            position: "absolute",
                            objectFit: "contain",
                            aspectRatio: "unset"
                        }} />
                    </div>) : null
                }
            </div>
        </div>
    );
};

export const Chairs = [
    "https://framerusercontent.com/images/mfSFGgGYoIPEgRTXQFA6vj2bBM.png",
    "https://framerusercontent.com/images/crCkDLb4A9Xb2FVQhqEPRdOuxI.png",
    "https://framerusercontent.com/images/mfSFGgGYoIPEgRTXQFA6vj2bBM.png",
    "https://framerusercontent.com/images/mXqlOpMKSQlSCvhW20s5PM4YM.png"
];

export default Season;
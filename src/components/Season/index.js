import React, { useMemo, useState, useEffect } from "react";
import Image from "next/image";

import checkOldPhone from "@/utils/mobileChecker";
import styles from "./season.module.css";

const SeasonComponent = ({
    chair,
    seasonTitle,
    children,
    className,
    style,
    ...otherProps
}) => {
    const arrayKeys = useMemo(() => [...Array(Math.max(1, Math.ceil((children?.length || 2) / 2 / 3.3))).keys()], [children]);

    const [isOldPhone, setIsOldPhone] = useState(true);

    useEffect(() => {
        setIsOldPhone(checkOldPhone());
    }, []);

    return (
        <div {...otherProps} className={[styles.season, styles.season_inside, otherProps.className || ""].join(" ")} tabIndex={0} style={{ ...style, display: "contents" }}>
            <div className={[styles.season_inside, styles.index_season_frame, className].join(" ")} style={{
                backgroundColor: "rgb(233, 233, 233)",
                boxShadow: "rgba(0, 0, 0, 0.1) 0px 2px 0px 0px, rgba(0, 0, 0, 0.1) 0px -2px 0px 0px",
                opacity: 1,
                minWidth: chair ? "inherit" : "unset"
            }}>
                {!isOldPhone && <div style={{
                    height: "100%",
                    width: "100%",
                    position: "absolute",
                    display: "flex",
                    background: "linear-gradient(rgba(255, 255, 255, 0.3), rgba(190, 189, 189, 0.3))",
                    overflow: "hidden"
                }}>
                    {
                        arrayKeys.map((i) => (
                            <div key={`season_${seasonTitle}_texture_${i}`} style={{ height: "100%", width: "auto", aspectRatio: 3 / 2, position: "relative" }}>
                                <Image
                                    alt="" fill={true}
                                    priority={true}
                                    className={styles.wall} sizes="90svh"
                                    src="https://framerusercontent.com/images/hxXL2jKccfg84wL6UdchMdB312c.jpg"
                                    style={{
                                        aspectRatio: 3 / 2,
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
                    aspectRatio: true ? `max(665.17, 8.22 * 20 * ${Math.ceil((children?.length || 2) / 2)} + 8.22 * 7 * ${Math.ceil((children?.length || 2) / 2) - 1})/543` : "unset"
                    // 8.22 = svh, 20 = coeff, number of columns + number of gaps 
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
                        <div style={{ minWidth: "1px", height: "100%", background: "black", aspectRatio: "inherit" }} />
                        <div style={{ 
                                display: "flex",
                                flexDirection: "column",
                                position: "relative",
                                alignItems: "flex-start",
                                flexWrap: "nowrap",
                                gap: "0px",
                                flex: "none"
                         }}>
                            <p className="framer-text" style={{ fontFamily: "Futura Condensed Extra", fontWeight: 700, fontSize: "1.27rem" }}>
                                {seasonTitle}
                            </p>
                            <span className="framer-text" style={{ fontFamily: "Radwave Demo", fontSize: "0.46rem", outline: "none", display: "flex", "flexDirection": "column", justifyContent: "flex-start", lineHeight: "1.15ch", paddingTop: "2px", transform: "none", opacity: 1 }}>
                                Présenté par Guillaume Hachez
                            </span>
                        </div>
                    </div>
                    <div className={styles.albums_container} data-framer-name="Albums" style={{ opacity: 1 }}>
                        {children}
                    </div>
                    <div className={styles.season_legende} data-framer-name="LEGENDE" style={{ opacity: 1 }}>
                        <Image src="/img/side_A.svg" unoptimized alt="" loading="lazy" width={31} height={12} />
                        <Image src="/img/45_rpm.svg" unoptimized alt="" loading="lazy" width={13} height={12} />
                        <Image src="/img/stereo.svg" unoptimized alt="" loading="lazy" width={28} height={12} />
                        <Image src="/img/import.svg" unoptimized alt="" loading="lazy" width={21} height={12} />
                        <div className={styles.richtextcontainer2} data-framer-component-type="RichTextContainer" style={{ outline: "none", display: "flex", flexDirection: "column", justifyContent: "flex-start", "--framer-paragraph-spacing": "0px", transform: "none", opacity: 1 }}>
                            <p className="framer-text" style={{ "--font-selector": "R0Y7T3N3YWxkLTYwMA==", "--framer-font-family": "\"Oswald\", \"Oswald Placeholder\", sans-serif", fontSize: "0.25rem", "--framer-font-weight": 600, "--framer-line-height": "3ch", "--framer-text-transform": "uppercase" }}>Disponible sur toutes</p>
                            <p className="framer-text" style={{ "--font-selector": "R0Y7T3N3YWxkLTYwMA==", "--framer-font-family": "\"Oswald\", \"Oswald Placeholder\", sans-serif", fontSize: "0.25rem", "--framer-font-weight": 600, "--framer-line-height": "3ch", "--framer-text-transform": "uppercase" }}>les plateformes</p>
                        </div>
                    </div>
                </div>
                {chair ?
                    (<div className={styles.chair} data-framer-name="Chair" direction={chair === Chairs[0] || chair === Chairs[2] ? "front" : "side"}>
                        <Image alt="" loading="lazy" className="chair_img" sizes="20svmin" src={chair} fill={true} style={{
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


const Season = React.memo(SeasonComponent);
Season.displayName = 'Season';

export default Season;
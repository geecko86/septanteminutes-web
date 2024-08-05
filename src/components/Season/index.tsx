import React, { useMemo, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";

import checkOldPhone from "@/utils/mobileChecker";
import styles from "./season.module.css";

import { MotionValue } from "framer-motion";

const HomeChair = dynamic(() => import("@/framer/ImageWrapper").then((mod) => mod.HomeChair), { ssr: false });

const PresentationWallContents = () => {
    const paragraphRef = React.useRef<HTMLParagraphElement>(null);
    const [overflowSize, setOverflowSize] = useState(30);

    useEffect(() => {
        const observer = new ResizeObserver((_) => {
            const overflow = (paragraphRef.current?.scrollHeight || 0) > (paragraphRef.current?.clientHeight || 0);
            if (overflow) setOverflowSize(val => Math.min(val + 10, 80));
        });

        const resizeCallback = () => {
            setOverflowSize(30);
        }
        
        if (paragraphRef.current) observer.observe(paragraphRef.current as Element);
        window.addEventListener("resize", resizeCallback);
        return () => {
            window.removeEventListener("resize", resizeCallback);
            observer.disconnect();
        };
    }, []);

    return (
        <div className={styles.presentationWallContents}>
            <div className={styles.presentationText}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img draggable="false" alt="Septante Minutes Avec" src="/img/sma_title.svg" />

                <div
                    ref={paragraphRef}
                    className={styles.presentationParagraph}
                    style={{
                        maxWidth: overflowSize > 30 ? `${overflowSize}vmax` : "auto", // make sure this is ok?
                        inlineSize: overflowSize > 30 ? "max-content" : "auto",
                        overflow: "hidden"
                    }}
                >
                    <span>Guillaume Hachez (b. 1994)</span>
                    <h1><strong>Podcast politique bimensuel belge</strong>,&nbsp;2018</h1>
                    <p>Disponible sur toutes les plateformes, il propose des interviews approfondies avec des invités issus du monde académique, politique, et culturel. Les épisodes explorent un large éventail de sujets de société, de la géopolitique à la neurodiversité, en passant par la technologie et le féminisme, le plus souvent avec une perspective belge ou internationale.<br/><br/>
                    <b>Septante Minutes Avec</b> vous fait repenser le monde, une conversation à la fois.</p>
                </div>
            </div>
        </div>
    );
};

const SeasonComponent = (props: {
    chair: string,
    seasonTitle: string,
    children: any[],
    className: string,
    style: React.CSSProperties,
    ready: boolean,
    position: number,
    playerVisible: boolean,
    motionValue: MotionValue
}) => {

    const { chair, seasonTitle, children, playerVisible, className, style, ready, position, motionValue, ...otherProps } = props;

    const arrayKeys = useMemo(() => [...Array(Math.max(1, Math.ceil((children?.length || 2) / 2 / 3.3))).keys()], [children]);

    const [isOldPhone, setIsOldPhone] = useState(true);

    useEffect(() => {
        setIsOldPhone(checkOldPhone());
    }, []);

    const presentationWall = position == 0 && !seasonTitle;

    return (
        <div {...otherProps} className={[styles.season, styles.season_inside].join(" ")} tabIndex={0} style={{ ...style, display: "contents" }}>
            <div className={[styles.season_inside, styles.index_season_frame, className, presentationWall ? styles.presentationWall : ""].join(" ")} style={{
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
                    pointerEvents: "none",
                    left: 0,
                    background: "linear-gradient(rgba(255, 255, 255, 0.3), rgba(190, 189, 189, 0.3))",
                    overflow: "hidden"
                }}>
                    {
                        arrayKeys.map((i) => (
                            <div key={`season_${seasonTitle}_texture_${i}`} style={{ height: "100%", width: "auto", aspectRatio: 3 / 2, position: "relative" }}>
                                <Image draggable="false"
                                    alt="" fill={true}
                                    priority={true}
                                    className={styles.wall} sizes="90vh"
                                    quality={50}
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
                    {!presentationWall && <div className={styles.header} key={`season_header_${seasonTitle}`} data-framer-name="Header">
                        <div className={styles.header_logo} data-framer-name="Logo">
                            <Image draggable="false"
                                alt="Septante Minutes Avec" fill={true}
                                className={styles.header_logo_img} sizes="128px"
                                src="/img/sma_title.svg"
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
                                {`SAISON ${seasonTitle}`}
                            </p>
                            <span className="framer-text" style={{ fontFamily: "Radwave Demo", fontSize: "0.46rem", outline: "none", display: "flex", "flexDirection": "column", justifyContent: "flex-start", lineHeight: "1.15ch", paddingTop: "2px", transform: "none", opacity: 1 }}>
                                Présenté par Guillaume Hachez
                            </span>
                        </div>
                    </div>}
                    {
                        presentationWall ? <PresentationWallContents /> :
                            <div className={styles.albums_container} data-framer-name="Albums" style={{ opacity: 1 }}>
                                {children}
                            </div>
                    }
                    {!presentationWall ? <div className={styles.season_legende} data-framer-name="LEGENDE" style={{ opacity: 1 }}>
                        <Image draggable="false" src="/img/side_A.svg" unoptimized alt="" loading="lazy" width={31} height={12} />
                        <Image draggable="false" src="/img/45_rpm.svg" unoptimized alt="" loading="lazy" width={13} height={12} />
                        <Image draggable="false" src="/img/stereo.svg" unoptimized alt="" loading="lazy" width={28} height={12} />
                        <Image draggable="false" src="/img/import.svg" unoptimized alt="" loading="lazy" width={21} height={12} />
                        <div className={styles.richtextcontainer2} data-framer-component-type="RichTextContainer" style={{ outline: "none", display: "flex", flexDirection: "column", justifyContent: "flex-start", transform: "none", opacity: 1 }}>
                            <p className="framer-text" style={{ fontFamily: "\"Oswald\", \"Oswald Placeholder\", sans-serif", fontSize: "0.25rem", fontWeight: 600, lineHeight: "3ch", textTransform: "uppercase" }}>Disponible sur toutes</p>
                            <p className="framer-text" style={{ fontFamily: "\"Oswald\", \"Oswald Placeholder\", sans-serif", fontSize: "0.25rem", fontWeight: 600, lineHeight: "3ch", textTransform: "uppercase" }}>les plateformes</p>
                        </div>
                    </div> : <div className={[styles.season_legende, playerVisible ? styles.player_visible : ""].join(" ")} data-framer-name="LEGENDE">
                    <span><Link href="/faq" scroll={false}><h1>FAQ</h1></Link></span>
                        { [
                            { name: "spotify", link: "https://open.spotify.com/show/1e5Wx2MUdGQNZupixNZw3r"},
                            { name: "applepodcasts", link: "https://podcasts.apple.com/be/podcast/septante-minutes-avec/id1435036591?mt=2" },
                            { name: "youtube", link: "https://www.youtube.com/@septanteminutes/videos" },
                            { name: "instagram_black", link: "https://www.instagram.com/GuiHachez/" },
                            { name: "rss", link: "https://anchor.fm/s/b43f59a8/podcast/rss" }].map((item) => (
                            <a key={item.name} href={item.link} target="_blank" style={item.name.endsWith("_black") ? { aspectRatio: 1, transform: "scale(1.23)" } : {}}>
                                <Image draggable="false" src={`/img/${item.name}.svg`} unoptimized alt={item.name.split("_")[0]} width={16} height={16} />
                            </a>
                        )) }
                    </div>}
                </div>
                {chair ?
                    (<div className={styles.chair} data-framer-name="Chair" >
                        <HomeChair alt="" className={styles.chair_img} priority={ready}
                            motionValue={motionValue} src={chair} style={{
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
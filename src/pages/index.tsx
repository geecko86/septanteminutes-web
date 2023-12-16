'use client';

import styles from "./index.module.css";
import React, {
    useState,
    useRef,
    useEffect,
    FC,
} from "react";
import { motion, useTransform, useMotionValue, useScroll, animate, useMotionValueEvent, AnimationPlaybackControls } from "framer-motion";
import Image from "next/image";
import { useRouter } from 'next/router';

import SwipeAnim from "../components/SwipeAnim";
import Season_, { Chairs } from "../components/Season";
import FrontColumn_, { FrontPosters } from "../components/FrontColumn";
import { usePlayback } from '../utils/PlayerContext';

import HomeAlbum_ from "../framer/HomeAlbum-WCxn.js";
import BellLamp_ from "../framer/BellLamp.js";
import Eggchair_ from "../framer/Eggchair.js";
import PlantA_ from "../framer/Plant_0.js";
import PlantA2_ from "../framer/Plant_2.js";
import PlantB_ from "../framer/Plant_1.js";
import PlantD_ from "../framer/Plant_3.js";
import PlantE_ from "../framer/Plant_4.js";

import ScrollToAnchor from "../utils/scroll_to_anchor";
import data from "../utils/tempdata.js";
import Head from "next/head";

import type { episode } from "../types/episode";

const variants = {
    hidden: { opacity: 0 },
    enter: { opacity: 1 },
    exit: { opacity: 0 },
};

export default function Home(props: {
    onReady: (ready: boolean) => void,
    ready: boolean
}) {

    const Season: FC<any> = Season_;
    const HomeAlbum: FC<any> = HomeAlbum_;
    const BellLamp: FC<any> = BellLamp_;
    const Eggchair: FC<any> = Eggchair_;
    const PlantA: FC<any> = PlantA_;
    const PlantA2: FC<any> = PlantA2_;
    const PlantB: FC<any> = PlantB_;
    const PlantD: FC<any> = PlantD_;
    const PlantE: FC<any> = PlantE_;
    const FrontColumn: FC<any> = FrontColumn_;

    const [seasons, setSeasons] = useState<Season[]>([]);
    const [screenContentRatio, setRatio] = useState(1);
    const [columnFocus, setColumnFocus] = useState(false);
    const [showSwiper, setShowSwiper] = useState(false);
    const [ready, setReady] = useState(false);

    const hasMovedRef = useRef(false), showSwiperRef = useRef(showSwiper), idleAnimRef = useRef<AnimationPlaybackControls | undefined>(undefined);

    const home = useRef<HTMLDivElement>(null), root = useRef<HTMLDivElement>(null), subroot = useRef<HTMLDivElement>(null);
    const layer0 = useRef(null), layer0_5 = useRef(null), layer1 = useRef(null), layer1_5 = useRef(null), layer2 = useRef(null), layer3 = useRef(null);

    const { setPlaying, isPlaying, setAutoplay, playbackTitle } = usePlayback();
    const { asPath } = useRouter();

    useEffect(() => {
        const vinyls = Array.from(
            { length: Object.keys(data.episodes).length },
            (v, k) => data.episodes[(k + 1).toString() as key]
        );
        setSeasons(
            [...new Set(vinyls.map(v => v.season))].map(season => ({
                name: season,
                episodes: vinyls.filter(ep => ep.season === season)
            }))
        );
    }, [data?.episodes]);

    useEffect(() => {
        setRatio((home.current?.clientWidth || 0) / (home.current?.clientHeight || 1));
    }, [home.current?.clientWidth])

    const { scrollX, scrollY } = useScroll();
    const scrollXAdditional = useMotionValue(0);
    const scrollYAdditional = useMotionValue(0);
    const newScrollX = useTransform(() => {
        if (!subroot?.current) return 0;

        let limit = (home.current?.clientWidth || window.innerWidth) - window.innerWidth;
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        if (isTouchDevice) {
            const smallerDim = Math.min(window.innerWidth, window.innerHeight);
            limit = (home.current?.clientWidth || smallerDim) - smallerDim;
            if (scrollX.get() >= limit) {
                window.scrollTo({
                    left: limit,
                    behavior: "instant"
                });
            }
        }

        const scrollSum = scrollX.get() + scrollY.get() + scrollXAdditional.get() + scrollYAdditional.get();
        if (scrollSum < 0) {
            console.warn("Negative scroll - reset");
            window.scrollTo({
                left: 0,
                behavior: "instant"
            })
            scrollXAdditional.set(0);
            scrollYAdditional.set(0);
            return 0;
        }

        if (typeof window === "undefined") {
            console.warn("undefined window", -scrollSum);
            return -scrollSum;
        };
        const output = Math.min(-Math.min(scrollSum, limit), 0);
        return output;
    });
    const offset0 = useTransform(() => newScrollX.get() * 0.15);
    const offset05 = useTransform(() => newScrollX.get() * 0.2);
    const offset15 = useTransform(() => newScrollX.get() * 1.15);
    const offset2 = useTransform(() => newScrollX.get() * 1.35);
    const offset3 = useTransform(() => newScrollX.get() * 2);

    const onHomeWheel = (e: WheelEvent) => {
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        const limit = (home.current?.clientWidth || 5000) - window.innerWidth;

        // console.log(newScrollX.get(), -limit, home.current?.clientWidth, window.innerWidth);
        if (newScrollX.get() <= -limit && e.deltaX + e.deltaY > 0) {
            console.log("BLOCK! A", e.deltaX + e.deltaY);
            scrollXAdditional.set(limit);
            scrollYAdditional.set(0);
            window.scrollTo({
                left: 0,
                top: 0,
                behavior: "instant"
            });
        } else if (newScrollX.get() >= 0 && e.deltaX + e.deltaY < 0) {
            console.log("BLOCK! B", e.deltaX + e.deltaY);
            return;
        } else {
            if (e.deltaY !== 0 && Math.abs(e.deltaY) > Math.abs(e.deltaX)) scrollYAdditional.set(scrollYAdditional.get() + e.deltaY);
            else if (e.deltaX !== 0) scrollXAdditional.set(scrollXAdditional.get() + e.deltaX);
            setColumnFocus(false);
            setShowSwiper(false);
            idleAnimRef.current?.stop();
        }
        e.preventDefault();
    };

    const interceptAutoScroll = (e: MouseEvent) => {
        if (e.button == 1) {
            e.preventDefault()
            console.log(e)
        }
    }

    const handleKeysDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        const scroll = Math.floor(window.innerWidth * 0.06);
        if (e.keyCode >= 37 && e.keyCode <= 40) {
            e.preventDefault();
            setShowSwiper(false);
            hasMovedRef.current = true;
            idleAnimRef.current?.stop();
        }
        switch (e.keyCode) {
            case 38: // up arrow
            case 37: // left arrow
                animate(scrollXAdditional, Math.max(0, scrollXAdditional.get() - scroll), { duration: 0.075 });
                break;
            case 39: // Right Arrow
            case 40: // Down Arrow
                const limit = (home.current?.clientWidth || window.innerWidth) - window.innerWidth;
                animate(scrollXAdditional, Math.min(scrollXAdditional.get() + scroll, limit), { duration: 0.075 });
                break;
            case 32:
                e.preventDefault();
                setPlaying(playing => !playing);
                break;
        }
    }

    useEffect(() => {
        if (!props.ready) return;

        root.current?.addEventListener("wheel", onHomeWheel, { passive: false });
        root.current?.addEventListener("mousedown", interceptAutoScroll, { passive: false });
        const swiperTimer = setInterval(() => {
            if (!hasMovedRef.current) {
                const from = scrollXAdditional.get(), to = scrollXAdditional.get() + Math.floor(window.innerWidth / 11);
                const anim = animate([[scrollXAdditional, to, {
                    duration: 0.9,
                    ease: "easeIn"
                }], [scrollXAdditional, [to, from], {
                    duration: 0.9,
                    delay: 1.5,
                    ease: "easeInOut"
                }], [scrollXAdditional, from, {
                    duration: 0,
                    delay: 3
                }]]);
                idleAnimRef.current = anim;
                idleAnimRef.current.then(() => {
                    hasMovedRef.current = false;
                    setShowSwiper(false);
                });
                setShowSwiper(true);
            } else {
                clearInterval(swiperTimer);
            }
        }, 10500);
        home.current?.focus();
        return () => {
            clearInterval(swiperTimer);
            root.current?.removeEventListener("wheel", onHomeWheel);
            root.current?.removeEventListener("mousedown", interceptAutoScroll);
        }
    }, [home, props.ready, onHomeWheel, scrollXAdditional]);

    useMotionValueEvent(newScrollX, "change", () => {
        hasMovedRef.current = true;
    });

    const posters = [
        { src: "https://framerusercontent.com/images/XRJGfu2ZZn2mWSL86QVmPhAfBE.jpg", class: styles.leuven, ratio: 440 / 228 },
        { src: "https://framerusercontent.com/images/iiwPEYtcgqr0GlVsNBXYW7X8.jpg", class: styles.akerman, ratio: 337 / 296 },
        { src: "https://framerusercontent.com/images/HSI69fi5yZ7EAlWBALNdz3stGI.jpg", class: styles.brel, ratio: 337 / 448 },
        { src: "https://framerusercontent.com/images/onpDPhhlUWDWDTFRwQ8urTPOXQs.jpg", class: styles.redford, ratio: 582 / 397 },
        { src: "https://framerusercontent.com/images/ZUrkjCIHCUv6FqcoUXJw3atquQ.webp", class: styles.cavell, ratio: 2267 / 1704 },
        { src: "https://framerusercontent.com/images/smcypGnQ7zED6TKSxE9PpqKBMxQ.jpg", class: styles.congo, ratio: 2267 / 1704 },
        { src: "https://framerusercontent.com/images/WiTE1wYTrGK2zx2OVVRi5QGnFg.jpg", class: styles.walenbuiten, ratio: 2267 / 1704 },
        { src: "https://framerusercontent.com/images/8euSsKe0GIbfmDH50p4BA8Enozw.jpg", class: styles.stones, ratio: 1 },
    ];

    return (
        <motion.div
            key="transition_loader"
            initial="hidden"
            animate={ready ? "enter" : "hidden"}
            exit="exit"
            variants={variants}
            transition={{ type: 'linear' }}
            className="transition_loader" >
            <div ref={subroot} className={styles.home_subroot} key={"home_subroot"}>
                <div ref={root} className={styles.home_root} key={"home_root"}>
                    <motion.div className={styles.home} key={"home"} ref={home} tabIndex={0} onKeyDown={handleKeysDown} style={{ translateZ: 0, translateX: newScrollX }}>
                        <Head>
                            <title>{playbackTitle ? `${isPlaying ? "▶ " : ""}${playbackTitle}` : "Septante Minutes Avec"}</title>
                        </Head>
                        <motion.div key="layer_0" ref={layer0} className={[styles.layer_0, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateZ: 0, translateX: offset0 }}>
                            <div className={styles.ceiling_3} key={"ceiling_3"} />
                            <div className={styles.ceiling_2} key={"ceiling_2"}>
                                {[...Array(Math.ceil(screenContentRatio / 2.4)).keys()].map((i) => (
                                    <Image priority={true} key={`ceiling_${i}`} src="https://framerusercontent.com/images/N99SQvccncY8lkqgpW8uypkR1E.png" alt="" style={{ transform: `scale(${i % 2 ? -1 : 1}, 1)` }} height={858} width={3618} />
                                ))}
                            </div>
                            <div className={styles.ceiling} key={"ceiling"} />
                            <div className={styles.backwall} key={"backwall"}>
                                <div className={styles.posters} key={"posters"}>
                                    {
                                        [...seasons].reverse().map((season, i) => (
                                            <React.Fragment key={season.name + "_invisible00_fragment"}>
                                                <Season key={season.name + "_invisible00"} className={styles.season_frame} chair={""} style={{ visibility: "hidden" }}>
                                                    {season.episodes.reverse().map((ep: episode) => (
                                                        <HomeAlbum key={`${ep.num}_invisible00`} image={""} num={ep.num} />
                                                    ))}
                                                </Season>
                                                {
                                                    <div className={[styles.poster, posters[i].class].join(" ")} key={`${season.name}_invisible00_poster_${i}`}>
                                                        <Image alt="" key={`${season.name}_invisible00_poster_img_${i}`} src={posters[i].src} quality={50} sizes={`${Math.floor(40 * posters[i].ratio)}vh`} fill />
                                                    </div>
                                                }
                                            </ React.Fragment>
                                        ))
                                    }
                                </div>
                                <div className={styles.backwall_light} key={"backwall_light"}>
                                    <Image priority={true} alt="" src="https://framerusercontent.com/images/FsKB3GEHFAPqgBfbeEkGrIb6lA.png" fill sizes="461vw" />
                                </div>
                                <div className={styles.backwall_paint} key={"backwall_paint"} />
                            </div>

                            <div className={styles.floor_3} key={"floor_3"} />
                            <div className={styles.floor_2} key={"floor_2"}>
                                {[...Array(Math.ceil(screenContentRatio / 2.4)).keys()].map((i) => (
                                    <Image priority={true} key={`floor_${i}`} src="https://framerusercontent.com/images/N99SQvccncY8lkqgpW8uypkR1E.png" alt="" style={{ transform: `scale(${i % 2 ? -1 : 1}, 1)` }} height={858} width={3618} />
                                ))}
                            </div>
                            <div className={styles.floor} key={"floor"} />
                        </motion.div>
                        <motion.div key="layer_0_5" ref={layer0_5} className={[styles.layer_0_5, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateZ: 0, translateX: offset05 }}>
                            <div className={styles.gap} key={"layer05_gap_A"} style={{ width: "calc(15 * var(--unit))" }} />
                            {
                                [...seasons].reverse().map((season, i) => (
                                    <React.Fragment key={season.name + "_invisible05_Fragment"}>
                                        <Season key={season.name + "_invisible05"} className={styles.season_frame} chair={""} style={{ visibility: "hidden" }}>
                                            {season.episodes.reverse().map((ep: episode) => (
                                                <HomeAlbum key={`${season.name}_homealbum_${ep.num}_invisible05`} image={""} num={ep.num} />
                                            ))}
                                        </Season>
                                        {
                                            [
                                                (<React.Fragment key={`deco05_0_${i}`}>
                                                    <PlantD key={`layer05_prop_${i}_PlantD`} className={styles.plant} style={{ zIndex: 2, left: "-15vh" }} />
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_1_${i}`}>
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: "unset" }} />
                                                    <PlantA key={`layer05_prop_${i}_PlantA`} className={[styles.plant, styles.left_m15].join(" ")} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_2_${i}`}>
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: "unset" }} />
                                                    <PlantB key={`layer05_prop_${i}_PlantB`} className={[styles.plant, styles.left_m15].join(" ")} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_3_${i}`}>
                                                    <PlantE key={`layer05_prop_${i}_PlantE`} className={[styles.plant, styles.left_m30].join(" ")} style={{ zIndex: 2, left: "30vh" }} />
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: "10vh" }} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_4_${i}`}>
                                                    <div key={`layer05_gap0_${i}_div`} className={styles.gap} style={{ width: "calc(55 * var(--unit))" }} />
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: "unset" }} />
                                                    <PlantB key={`layer05_prop_${i}_PlantB`} className={[styles.plant, styles.left_m15].join(" ")} />
                                                </ React.Fragment>)
                                            ][i % 5]
                                        }
                                        <div key={`layer05_gap_${i}`} className={styles.gap} style={{ width: "calc(25 * var(--unit))" }} />
                                    </ React.Fragment>
                                ))
                            }
                        </motion.div>
                        <motion.div key="layer_1" ref={layer1} className={[styles.layer_1, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")}>
                            {
                                [...seasons].reverse().map((season, i) => (
                                    <Season key={`${season.name}_visible1`} seasonTitle={`SAISON ${season.name}`} chair={Chairs[i % 4]} className={styles.season_frame}>
                                        {season.episodes.toReversed().map((ep: episode, j: number) => (
                                            <HomeAlbum id={`art_${ep.num}`} guest={ep.title} key={`${ep.num}_visible1`} image={ep.img} num={ep.num}
                                                onReady={i == 0 && j == 0 && !asPath.includes("#") ? (status: boolean) => {
                                                    if (!props.ready) props.onReady(status);
                                                    setReady(status);
                                                } : null}
                                                onClick={(e: MouseEvent) => {
                                                    if (e.button != 0) return;
                                                    setReady(false)
                                                    setAutoplay(ep);
                                                }} />
                                        ))}
                                    </Season>
                                ))
                            }
                        </motion.div>
                        <motion.div key="layer_1_5" ref={layer1_5} className={[styles.layer_1_5, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateZ: 0, translateX: offset15 }}>
                            <div className={styles.lamps_1_5} key={"lamps_1_5"} >
                                {[...Array(Math.ceil(1.6 * screenContentRatio)).keys()].map((i) => (
                                    <BellLamp key={`lamp_1_5_${i}`} className={styles.lamp} />
                                ))}
                            </div>
                        </motion.div>
                        <motion.div key="layer_2" ref={layer2} className={[styles.layer_2, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateZ: 0, translateX: offset2 }}>
                            <div className={styles.lamps_2} key={"lamps_2"}>
                                {[...Array(Math.ceil(1.5 * screenContentRatio)).keys()].map((i) => (
                                    <BellLamp key={`lamp_2_${i}`} className={styles.lamp} />
                                ))}
                            </div>
                        </motion.div>
                        <div key="layer_3" className={[styles.layer, styles.layer_3_wrapper].join(" ")}>
                            <motion.div ref={layer3} className={[styles.layer_3, styles.layer].join(" ")} style={{ translateZ: 0, translateX: offset3 }}>
                                {[...Array(Math.floor(screenContentRatio / 3.1)).keys()].map((i) => (
                                    <React.Fragment key={`layer3_deco_${i}`}>
                                        <PlantA2 key={`layer3_prop_${i}_PlantA2`} className={[styles.plant_front, columnFocus ? styles.blurReady : styles.blur8].join(" ")} />
                                        <FrontColumn key={`layer3_prop_${i}_FrontColumn`} className={[styles.front_column, columnFocus ? "" : styles.blur8].join(" ")}
                                            pic={FrontPosters[i % 4].img} subtitle={FrontPosters[i % 4].text} ratio={FrontPosters[i % 4].ratio} date={FrontPosters[i % 4].date}
                                            onMouseMove={() => { setColumnFocus(true) }} onMouseLeave={() => { setColumnFocus(false) }} />
                                    </ React.Fragment>
                                ))}
                            </motion.div>
                        </div>
                        <SwipeAnim play={showSwiper} className={styles.swipe_anim} key={"swipe_anim"} />
                    </motion.div>
                </div>
                <ScrollToAnchor move={(x) => {
                    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                    if (isTouchDevice) {
                        window.scrollBy({
                            left: x,
                            behavior: "instant"
                        });
                    } else {
                        scrollXAdditional.set(x);
                    }
                    if (!props.ready) props.onReady(true);
                    setReady(true);
                    hasMovedRef.current = false;
                }} />
            </div>
        </motion.div>
    );
}

type key = "1" | "2"; // Etc.

type Season = {
    name: string,
    episodes: episode[]
};
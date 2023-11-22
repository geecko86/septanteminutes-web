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

import SwipeAnim from "../components/SwipeAnim";
import Season_, { Chairs } from "../framer/Season-pOfC.js";
import HomeAlbum_ from "../framer/HomeAlbum-WCxn.js";
import BellLamp_ from "../framer/BellLamp.js";
import Eggchair_ from "../framer/Eggchair.js";
import PlantA_ from "../framer/Plant_0.js";
import PlantB_ from "../framer/Plant_1.js";
import PlantC_ from "../framer/Plant_2.js";
import FrontColumn_, { FrontPosters } from "../framer/front-column-h3ym.js";

import ScrollToAnchor from "../utils/scroll_to_anchor";
import data from "../utils/tempdata.js";
import Head from "next/head";

export default function Home() {

    const Season: FC<any> = Season_;
    const HomeAlbum: FC<any> = HomeAlbum_;
    const BellLamp: FC<any> = BellLamp_;
    const Eggchair: FC<any> = Eggchair_;
    const PlantA: FC<any> = PlantA_;
    const PlantB: FC<any> = PlantB_;
    const PlantC: FC<any> = PlantC_;
    const FrontColumn: FC<any> = FrontColumn_;

    const [seasons, setSeasons] = useState<any[]>([]);
    const [screenContentRatio, setRatio] = useState(1);
    const [columnFocus, setColumnFocus] = useState(false);
    const [showSwiper, setShowSwiper] = useState(false);

    const hasMovedRef = useRef(false), showSwiperRef = useRef(showSwiper), idleAnimRef = useRef<AnimationPlaybackControls | undefined>(undefined);
    const idleCallbackRef = useRef<number>(0);

    const home = useRef<HTMLDivElement>(null), root = useRef<HTMLDivElement>(null), subroot = useRef<HTMLDivElement>(null);
    const layer0 = useRef(null), layer0_5 = useRef(null), layer1 = useRef(null), layer1_5 = useRef(null), layer2 = useRef(null), layer3 = useRef(null);

    useEffect(() => {
        const vinyls = Array.from(
            { length: Object.keys(data.episodes).length },
            (v, k) => data.episodes[(k + 1).toString() as key]
        );
        setSeasons([...new Set(vinyls.map(v => v.season))].map(season => ({
            name: season,
            episodes: vinyls.filter(ep => ep.season === season)
        })))
    }, [data]);

    useEffect(() => {
        root.current?.addEventListener("wheel", onHomeWheel, { passive: false });
        const swiperTimer = setInterval(() => {
            if (!hasMovedRef.current) {
                const from = scrollXAdditional.get(), to = scrollXAdditional.get() + Math.floor(window.innerWidth / 11);
                const anim = animate([[scrollXAdditional, to, {
                    duration: 0.45,
                    ease: "easeIn"
                }], [scrollXAdditional, [to, from], {
                    duration: 0.45,
                    delay: 0.75,
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
        }, 6500);
        home.current?.focus();
        return () => { clearInterval(swiperTimer); }
    }, [home]);
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
        } else {
            if (e.deltaX !== 0) scrollXAdditional.set(scrollXAdditional.get() + e.deltaX);
            else if (e.deltaY !== 0) scrollYAdditional.set(scrollYAdditional.get() + e.deltaY);
            setColumnFocus(false);
            setShowSwiper(false);
            idleAnimRef.current?.stop();
        }
        e.preventDefault();
    };

    const handleArrowsDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        switch (e.keyCode) {
            case 38: // up arrow
            case 37: // left arrow
                const scroll = -Math.floor(window.innerWidth * 0.06);
                animate(scrollXAdditional, scrollXAdditional.get() + scroll, { duration: 0.075 });
            case 39:
            case 40:
                setShowSwiper(false);
                hasMovedRef.current = true;
                idleAnimRef.current?.stop();
                if (("cancelIdleCallback" in window)) {
                    // TODO Fixme Safari
                    cancelIdleCallback(idleCallbackRef.current);
                }
                break;
        }
    }

    const handleArrowsUp = (e: React.KeyboardEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        switch (e.keyCode) {
            case 40: // down arrow
            case 39: // right arrow;
                if (!("requestIdleCallback" in window)) {
                    // TODO Fixme Safari
                    return;
                }
                const idleCallback = requestIdleCallback(() => {
                    const limit = (home.current?.clientWidth || 5000) - window.innerWidth;
                    scrollXAdditional.set(Math.min(limit, scrollXAdditional.get() + scrollX.get()));
                    window.scrollTo({
                        left: 0,
                        behavior: "instant"
                    });
                    scrollX.set(0);
                });
                idleCallbackRef.current = idleCallback;
                break;
        }
    };

    useMotionValueEvent(newScrollX, "change", () => {
        hasMovedRef.current = true;
    });

    const posters = [
        { src: "https://framerusercontent.com/images/XRJGfu2ZZn2mWSL86QVmPhAfBE.jpg", style: styles.leuven },
        { src: "https://framerusercontent.com/images/iiwPEYtcgqr0GlVsNBXYW7X8.jpg", style: styles.akerman },
        { src: "https://framerusercontent.com/images/HSI69fi5yZ7EAlWBALNdz3stGI.jpg", style: styles.brel },
        { src: "https://framerusercontent.com/images/onpDPhhlUWDWDTFRwQ8urTPOXQs.jpg", style: styles.redford },
        { src: "https://framerusercontent.com/images/ZUrkjCIHCUv6FqcoUXJw3atquQ.webp", style: styles.cavell },
        { src: "https://framerusercontent.com/images/smcypGnQ7zED6TKSxE9PpqKBMxQ.jpg", style: styles.congo },
        { src: "https://framerusercontent.com/images/WiTE1wYTrGK2zx2OVVRi5QGnFg.jpg", style: styles.walenbuiten },
        { src: "https://framerusercontent.com/images/8euSsKe0GIbfmDH50p4BA8Enozw.jpg", style: styles.stones },
    ]

    return (
        <div ref={subroot} className={styles.home_subroot}>
            <div ref={root} className={styles.home_root}>
                <motion.div className={styles.home} ref={home} tabIndex={0} onKeyDown={handleArrowsDown} onKeyUp={handleArrowsUp} style={{ translateX: newScrollX }}>
                    <Head>
                        <title>{"Septante Minutes Avec"}</title>
                    </Head>
                    <motion.div key="layer_0" ref={layer0} className={[styles.layer_0, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateX: offset0 }}>
                        <div className={styles.ceiling_3} />
                        <div className={styles.ceiling_2}>
                            <Image loading="eager" src="https://framerusercontent.com/images/N99SQvccncY8lkqgpW8uypkR1E.png" alt="" fill sizes={`${home.current?.clientWidth}px`} />
                        </div>
                        <div className={styles.ceiling} />
                        <div className={styles.backwall}>
                            <div className={styles.posters}>
                                {
                                    [...seasons].reverse().map((season, i) => (
                                        <>
                                            <Season key={season.name + "_invisible"} className={styles.season_frame} chair={""} style={{ visibility: "hidden" }}>
                                                {season.episodes.reverse().map((ep: episode) => (
                                                    <HomeAlbum key={ep.num} image={""} num={ep.num} />
                                                ))}
                                            </Season>
                                            {
                                                <div className={[styles.poster, posters[i].style].join(" ")} key={`poster_${i}`}>
                                                    <Image alt="" src={posters[i].src} sizes="40vw" fill />
                                                </div>
                                            }
                                        </>
                                    ))
                                }
                            </div>
                            <div className={styles.backwall_light}>
                                <Image loading="eager" alt="" src="https://framerusercontent.com/images/FsKB3GEHFAPqgBfbeEkGrIb6lA.png" fill priority={true} sizes="461vw" />
                            </div>
                            <div className={styles.backwall_paint} />
                        </div>

                        <div className={styles.floor_3} />
                        <div className={styles.floor_2}>
                            <Image loading="eager" src="https://framerusercontent.com/images/N99SQvccncY8lkqgpW8uypkR1E.png" alt="" fill sizes={`${home.current?.clientWidth}px`} />
                        </div>
                        <div className={styles.floor} />
                    </motion.div>
                    <motion.div key="layer_0_5" ref={layer0_5} className={[styles.layer_0_5, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateX: offset05 }}>
                        <div className={styles.gap} style={{ width: "calc(15 * var(--unit))" }} />
                        {
                            [...seasons].reverse().map((season, i) => (
                                <>
                                    <Season key={season.name + "_invisible"} className={styles.season_frame} chair={""} style={{ visibility: "hidden" }}>
                                        {season.episodes.reverse().map((ep: episode) => (
                                            <HomeAlbum key={ep.num} image={""} num={ep.num} />
                                        ))}
                                    </Season>
                                    {
                                        [
                                            (<>
                                                <PlantA className={styles.plant} style={{ zIndex: 2 }} />
                                                <Eggchair className={styles.eggchair} />
                                            </>),
                                            (<>
                                                <Eggchair className={styles.eggchair} style={{ zIndex: 2, left: "unset" }} />
                                                <PlantB className={[styles.plant, styles.left_m15].join(" ")} />
                                            </>),
                                            (<>
                                                <Eggchair className={styles.eggchair} style={{ zIndex: 2, left: "unset" }} />
                                                <PlantA className={[styles.plant, styles.left_m15].join(" ")} />
                                            </>)
                                        ][i % 3]
                                    }
                                    <div className={styles.gap} style={{ width: "calc(25 * var(--unit))" }} />
                                </>
                            ))
                        }
                    </motion.div>
                    <motion.div key="layer_1" ref={layer1} className={[styles.layer_1, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")}>
                        {
                            [...seasons].reverse().map((season, i) => (
                                <Season key={season.name} seasonTitle={`SAISON ${season.name}`} chair={Chairs[i % 4]} className={styles.season_frame}>
                                    {season.episodes.toReversed().map((ep: episode) => (
                                        <HomeAlbum id={`art_${ep.num}`} guest={ep.title} key={ep.num} image={ep.img} num={ep.num} />
                                    ))}
                                </Season>
                            ))
                        }
                    </motion.div>
                    <motion.div key="layer_1_5" ref={layer1_5} className={[styles.layer_1_5, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateX: offset15 }}>
                        <div className={styles.lamps_1_5} >
                            {[...Array(Math.ceil(1.6 * screenContentRatio)).keys()].map((i) => (
                                <BellLamp key={`lamp_1_5_${i}`} className={styles.lamp} />
                            ))}
                        </div>
                    </motion.div>
                    <motion.div key="layer_2" ref={layer2} className={[styles.layer_2, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateX: offset2 }}>
                        <div className={styles.lamps_2}>
                            {[...Array(Math.ceil(1.5 * screenContentRatio)).keys()].map((i) => (
                                <BellLamp key={`lamp_2_${i}`} className={styles.lamp} />
                            ))}
                        </div>
                    </motion.div>
                    <div key="layer_3" className={[styles.layer, styles.layer_3_wrapper].join(" ")}>
                        <motion.div ref={layer3} className={[styles.layer_3, styles.layer].join(" ")} style={{ translateX: offset3 }}>
                            {[...Array(Math.floor(screenContentRatio / 3.1)).keys()].map((i) => (
                                <>
                                    <PlantC className={[styles.plant_front, columnFocus ? styles.blurReady : styles.blur8].join(" ")} />
                                    <FrontColumn className={[styles.front_column].join(" ")}
                                        pic={FrontPosters[i % 4].img} subtitle={FrontPosters[i % 4].text} ratio={FrontPosters[i % 4].ratio} date={FrontPosters[i % 4].date}
                                        onMouseEnter={() => { setColumnFocus(true) }} onMouseLeave={() => { setColumnFocus(false) }} />
                                </>
                            ))}
                        </motion.div>
                    </div>
                    <div className={styles.swipe_anim}>
                        <SwipeAnim play={showSwiper} />
                    </div>
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
                hasMovedRef.current = false;
            }} />
        </div>
    );
}

type key = "1" | "2"; // Etc.
type episode = {
    title: string; img: string, num: number
}
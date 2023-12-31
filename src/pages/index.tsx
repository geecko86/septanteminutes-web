'use client';

import styles from "./index.module.css";
import React, {
    useState,
    useRef,
    useEffect,
    FC,
} from "react";
import { motion, useTransform, useMotionValue, useScroll, animate, useMotionValueEvent, AnimationPlaybackControls, useVelocity, MotionValue, usePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from 'next/router';

import SwipeAnim from "../components/SwipeAnim";
import Season_, { Chairs } from "../components/Season";
import FrontColumn_, { FrontPosters } from "../components/FrontColumn";
import { usePlayback } from '../utils/PlayerContext';

import HomeAlbum_ from "../framer/HomeAlbum-WCxn.js";
import { BellLamp as BellLamp_, Plant0 as PlantA_, Eggchair as Eggchair_, Plant1 as PlantB_, Plant2 as PlantA2_, Plant3 as PlantD_, Plant4 as PlantE_ } from "../framer/ImageWrapper.js";

import ScrollToAnchor, { getEpisodeNum as getTargetEpisodeNum } from "../utils/scroll_to_anchor"
import data from "../utils/tempdata.js";
import Head from "next/head";

import type { episode } from "../types/episode";
import Poster from "@/components/Poster";

const variants = {
    hidden: { opacity: 0 },
    enter: { opacity: 1 },
    exit: { opacity: 0 },
};

export default function Home(props: {
    onReady: () => void,
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

    const hasMovedRef = useRef(false), showSwiperRef = useRef(showSwiper), idleAnimRef = useRef<AnimationPlaybackControls | undefined>(undefined);

    const home = useRef<HTMLDivElement>(null), root = useRef<HTMLDivElement>(null), subroot = useRef<HTMLDivElement>(null);
    const layer0 = useRef(null), layer0_5 = useRef(null), layer1 = useRef(null), layer1_5 = useRef(null), layer2 = useRef(null), layer3 = useRef(null);
    const firstAlbum = useRef<HTMLImageElement>(null);

    const { setPlaying, isPlaying, setAutoplay, playbackTitle } = usePlayback();
    const router = useRouter();
    const [isPresent, safeToRemove] = usePresence();

    useEffect(() => {
        const vinyls = Array.from(
            { length: Object.keys(data.episodes).length },
            (v, k) => data.episodes[(k + 1).toString() as key]
        );
        const seasons = [...new Set(vinyls.map(v => v.season))].map(season => ({
            name: season,
            episodes: vinyls.filter(ep => ep.season === season)
        }));
        setSeasons(seasons);
    }, [data?.episodes]);

    useEffect(() => {
        setRatio((home.current?.clientWidth || 0) / (home.current?.clientHeight || 1));
    }, [home.current?.clientWidth]);

    const { scrollX, scrollY } = useScroll();
    const scrollXAdditional = useMotionValue(0);
    const scrollYAdditional = useMotionValue(0);
    const newScrollX: MotionValue = useTransform(() => {
        if (!subroot?.current) return 0;

        let limit = (home.current?.clientWidth || 0) > window.innerWidth ?
            (home.current?.clientWidth || window.innerWidth) - window.innerWidth : 0;
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
            return newScrollX ? Math.floor(newScrollX.get() / 2) : 0;
        } else if (scrollSum > limit) {
            console.warn("Overscroll", scrollSum, limit, scrollSum - limit);
            return -limit;
        }

        if (typeof window === "undefined") {
            console.warn("undefined window", -scrollSum);
            return -scrollSum;
        };
        const output = -Math.min(scrollSum, limit);
        return output;
    });

    const velocity = useVelocity(newScrollX);

    const offset0 = useTransform(() => newScrollX.get() * -0.32);
    const offset05 = useTransform(() => newScrollX.get() * -0.25);
    const offset15 = useTransform(() => newScrollX.get() * 1.15);
    const offset2 = useTransform(() => newScrollX.get() * 1.35);
    const offset3 = useTransform(() => newScrollX.get() * 2);

    const onHomeWheel = (e: WheelEvent) => {
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        const limit = (home.current?.clientWidth || 5000) - window.innerWidth;

        // console.log(newScrollX.get(), -limit, home.current?.clientWidth, window.innerWidth);
        if (newScrollX.get() <= -limit && e.deltaX + e.deltaY > 0) {
            console.log("BLOCK! A", e.deltaX + e.deltaY);
            // scrollXAdditional.set(limit);
            // scrollYAdditional.set(0);
            // window.scrollTo({
            //     left: 0,
            //     top: 0,
            //     behavior: "instant"
            // });
        } else if (newScrollX.get() >= -1 && e.deltaX + e.deltaY < 0) {
            console.log("BLOCK! B", e.deltaX + e.deltaY);
            if (e.deltaY < 0 && scrollYAdditional.get() + e.deltaY < 0) scrollYAdditional.set(0);
            if (e.deltaX < 0 && scrollXAdditional.get() + e.deltaX < 0) scrollXAdditional.set(0);
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
        }, 1750);
        home.current?.focus();
        return () => {
            clearInterval(swiperTimer);
            root.current?.removeEventListener("wheel", onHomeWheel);
            root.current?.removeEventListener("mousedown", interceptAutoScroll);
        }
    }, [home, props.ready, onHomeWheel, scrollXAdditional]);

    useMotionValueEvent(newScrollX, "change", val => {
        if (val < -3) hasMovedRef.current = true;
    });

    useEffect(() => {
        if (!firstAlbum.current) return;
        if (!router.asPath.includes("#") && isPresent && !props.ready) {
            if (firstAlbum.current.complete) props.onReady();
            else firstAlbum.current.onload = props.onReady;
        }
    }, [firstAlbum.current, firstAlbum.current?.complete, isPresent, props.ready]);

    const posters = [
        { src: "https://framerusercontent.com/images/XRJGfu2ZZn2mWSL86QVmPhAfBE.jpg", className: styles.leuven, ratio: 440 / 228, parallaxFactor: 120 },
        { src: "https://framerusercontent.com/images/iiwPEYtcgqr0GlVsNBXYW7X8.jpg", className: styles.akerman, ratio: 337 / 296 },
        { src: "https://framerusercontent.com/images/HSI69fi5yZ7EAlWBALNdz3stGI.jpg", className: styles.brel, ratio: 337 / 448 },
        { src: "https://framerusercontent.com/images/onpDPhhlUWDWDTFRwQ8urTPOXQs.jpg", className: styles.redford, ratio: 582 / 397, parallaxFactor: 120 },
        { src: "https://framerusercontent.com/images/ZUrkjCIHCUv6FqcoUXJw3atquQ.webp", className: styles.cavell, ratio: 2267 / 1704, parallaxFactor: 130 },
        { src: "https://framerusercontent.com/images/smcypGnQ7zED6TKSxE9PpqKBMxQ.jpg", className: styles.congo, ratio: 2267 / 1704, parallaxFactor: 130 },
        { src: "https://framerusercontent.com/images/WiTE1wYTrGK2zx2OVVRi5QGnFg.jpg", className: styles.walenbuiten, ratio: 2267 / 1704, parallaxFactor: 130 },
        { src: "https://framerusercontent.com/images/8euSsKe0GIbfmDH50p4BA8Enozw.jpg", className: styles.stones, ratio: 1 },
    ];

    return (
        <motion.div
            key="transition_loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: props.ready && isPresent && router.pathname === "/" ? 1 : 0 }}
            transition={{ type: 'linear', duration: 0.25 }}
            onUpdate={(latest: { opacity: number}) => {
                if (latest.opacity === 0 && !isPresent && !!safeToRemove) safeToRemove();
            }}
            className="transition_loader" >
            <div ref={subroot} className={styles.home_subroot} key={"home_subroot"}>
                <div ref={root} className={styles.home_root} key={"home_root"}>
                    <motion.div className={styles.home} key={"home"} ref={home} tabIndex={0} onKeyDown={handleKeysDown} style={{ translateZ: 0, translateX: newScrollX }}>
                        <Head>
                            <title>{playbackTitle ? `${isPlaying ? "▶ " : ""}${playbackTitle}` : "Septante Minutes Avec"}</title>
                        </Head>
                        <motion.div key="layer_0" ref={layer0} className={[styles.layer_0, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateZ: 0 }}>
                            <div className={styles.ceiling_3} key={"ceiling_3"} />
                            <div className={styles.ceiling_2} key={"ceiling_2"}>
                                {[...Array(Math.ceil(screenContentRatio / 2.4)).keys()].map((i) => (
                                    <Image priority={true} key={`ceiling_${i}`} src="https://framerusercontent.com/images/N99SQvccncY8lkqgpW8uypkR1E.png" alt="" style={{ transform: `scale(${i % 2 ? -1 : 1}, 1)` }} height={858} width={3618} />
                                ))}
                            </div>
                            <div className={styles.ceiling} key={"ceiling"} />
                            <div className={styles.backwall} key={"backwall"}>
                                <motion.div className={styles.backwall_light} key={"backwall_light"} style={{translateX: offset0, translateZ: 0}} >
                                    <Image priority={true} alt="" src="https://framerusercontent.com/images/FsKB3GEHFAPqgBfbeEkGrIb6lA.png" fill sizes="461vw" />
                                </motion.div>
                                <motion.div className={styles.backwall_paint} key={"backwall_paint"} style={{x: offset0, translateZ: 0}}/>
                                <div className={styles.posters} key={"posters"}>
                                    {
                                        [...seasons].reverse().map((season, i) => (
                                            <React.Fragment key={season.name + "_invisible00_fragment"}>
                                                <Season key={season.name + "_invisible00"} className={styles.season_frame} chair={""} style={{ visibility: "hidden" }}>
                                                    {season.episodes.map((ep: episode) => (
                                                        <HomeAlbum key={`${ep.num}_invisible00`} image={""} num={ep.num} />
                                                    ))}
                                                </Season>
                                                {
                                                    <Poster className={[styles.poster, posters[i].className].join(" ")} key={`${season.name}_poster_${i}`} poster={posters[i]} motionValue={newScrollX} />
                                                }
                                            </ React.Fragment>
                                        ))
                                    }
                                </div>
                            </div>

                            <div className={styles.floor_3} key={"floor_3"} />
                            <div className={styles.floor_2} key={"floor_2"}>
                                {[...Array(Math.ceil(screenContentRatio / 2.4)).keys()].map((i) => (
                                    <Image priority={true} key={`floor_${i}`} src="https://framerusercontent.com/images/N99SQvccncY8lkqgpW8uypkR1E.png" alt="" style={{ transform: `scale(${i % 2 ? -1 : 1}, 1)` }} height={858} width={3618} />
                                ))}
                            </div>
                            <div className={styles.floor} key={"floor"} />
                        </motion.div>
                        <motion.div key="layer_0_5" ref={layer0_5} className={[styles.layer_0_5, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateZ: 0 }}>
                            {
                                [...seasons].reverse().map((season, i) => (
                                    <React.Fragment key={season.name + "_invisible05_Fragment"}>
                                        <Season key={season.name + "_invisible05"} className={[styles.season_frame, styles.invisible_season].join(" ")} chair={""} style={{ visibility: "hidden" }}>
                                            {season.episodes.map((ep: episode) => (
                                                <HomeAlbum key={`${season.name}_homealbum_${ep.num}_invisible05`} image={""} num={ep.num} />
                                            ))}
                                        </Season>
                                        {
                                            [
                                                (<React.Fragment key={`deco05_0_${i}`}>
                                                    <PlantD key={`layer05_prop_${i}_PlantD`} className={styles.plant} style={{ zIndex: 2, left: "-5vh" }} motionValue={newScrollX} onReady={() => {
                                                        if (firstAlbum.current) {
                                                            if (firstAlbum.current.complete) props.onReady();
                                                            else firstAlbum.current.onload = props.onReady
                                                        }
                                                    }} />
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} motionValue={newScrollX} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_1_${i}`}>
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: "unset" }} motionValue={newScrollX} />
                                                    <PlantA key={`layer05_prop_${i}_PlantA`} className={[styles.plant, styles.left_m15].join(" ")} motionValue={newScrollX} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_2_${i}`}>
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: "unset" }} motionValue={newScrollX} />
                                                    <PlantB key={`layer05_prop_${i}_PlantB`} className={[styles.plant, styles.left_m15].join(" ")} motionValue={newScrollX} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_3_${i}`}>
                                                    <PlantE key={`layer05_prop_${i}_PlantE`} className={[styles.plant, styles.left_m30].join(" ")} style={{ zIndex: 2, left: "-10vh" }} motionValue={newScrollX} />
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: "" }} motionValue={newScrollX} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_4_${i}`}>
                                                        <div key={`layer05_gap0_${i}_div`} className={styles.gap} style={{ width: "calc(55 * var(--unit))" }} />
                                                        <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: "unset" }} motionValue={newScrollX} />
                                                        <PlantB key={`layer05_prop_${i}_PlantB`} className={[styles.plant, styles.left_m15].join(" ")} motionValue={newScrollX} />
                                                </ React.Fragment>)
                                            ][i % 5]
                                        }
                                    </ React.Fragment>
                                ))
                            }
                        </motion.div>
                        <motion.div key="layer_1" ref={layer1} className={[styles.layer_1, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")}>
                            {
                                [...seasons].reverse().map((season, i) => (
                                    <Season key={`${season.name}_visible1`} seasonTitle={`SAISON ${season.name}`} chair={Chairs[i % 4]} className={styles.season_frame}>
                                        {season.episodes.toReversed().map((ep: episode, j: number) => (
                                            <HomeAlbum id={`art_${ep.num}`} ref={(i == 0 && j == 0 && !router.asPath.includes("#") || router.asPath.split("#")[1] === ep.num) ? firstAlbum : null} guest={ep.title} key={`${ep.num}_visible1`} image={ep.img} num={ep.num}
                                                onClick={(e: MouseEvent) => {
                                                    if (e.button != 0) return;
                                                    // setAutoplay(ep);
                                                    // TODO enable again
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
                    if (x > 0) {
                        x = Math.min(x, (home.current?.clientWidth || window.innerWidth) - window.innerWidth);
                        if (isTouchDevice) {
                            window.scrollBy({
                                left: x,
                                behavior: "instant"
                            });
                        } else {
                            scrollXAdditional.set(x);
                        }
                        console.log("scrolled", x);
                    }
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
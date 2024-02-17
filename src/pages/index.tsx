'use client';

import styles from "./index.module.css";
import React, {
    useState,
    useRef,
    useEffect,
    useMemo,
    FC,
} from "react";
import { motion, useTransform, useMotionValue, useScroll, animate, useMotionValueEvent, AnimationPlaybackControls, useVelocity, MotionValue, usePresence } from "framer-motion";
import Image from "next/image";
import { useRouter } from 'next/router';
import { isSafari, isIOS, isFirefox, isAndroid, isMobile } from 'react-device-detect';

import SwipeAnim from "../components/SwipeAnim";
import Season_, { Chairs } from "../components/Season";
import FrontColumn_, { FrontPosters } from "../components/FrontColumn";
import { usePlayback } from '../utils/PlayerContext';

import HomeAlbum_ from "../framer/HomeAlbum-WCxn.js";
import { BellLamp as BellLamp_, Plant0 as PlantA_, Eggchair as Eggchair_, Plant1 as PlantB_, Plant2 as PlantA2_, Plant3 as PlantD_, Plant4 as PlantE_, BackwallLight } from "../framer/ImageWrapper.js";

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
    const [offset3_factor, setOffset3Factor] = useState<number>(0.5);
    
    const hasMovedRef = useRef(false), showSwiperRef = useRef(showSwiper), idleAnimRef = useRef<AnimationPlaybackControls | undefined>(undefined);
    const home = useRef<HTMLDivElement>(null), root = useRef<HTMLDivElement>(null), subroot = useRef<HTMLDivElement>(null);
    const layer0 = useRef<HTMLDivElement>(null), layer0_5 = useRef<HTMLDivElement>(null), layer1 = useRef<HTMLDivElement>(null), layer1_5 = useRef(null), layer2 = useRef(null), layer3 = useRef(null);
    const firstAlbum = useRef<HTMLImageElement>(null), firstPoster = useRef<HTMLDivElement>(null);
    const resolveScrollRef = useRef<(() => void) | null>(null);

    const { setPlaying, isPlaying, setAutoplay, playbackTitle } = usePlayback();
    const router = useRouter();
    const [isPresent, safeToRemove] = usePresence();

    const floorKeys = useMemo(() => [...Array(Math.ceil(screenContentRatio)).keys()], [screenContentRatio]);
    
    useEffect(() => {
        const vinyls = Array.from(
            { length: Object.keys(data.episodes).length },
            (v, k) => data.episodes[(k + 1).toString() as key]
        );
        const seasons = [...new Set(vinyls.map(v => v.season))].map(season => ({
            name: season,
            episodes: vinyls.filter(ep => ep.season === season)
        }));
        setSeasons([...seasons].reverse());
    }, [data?.episodes]);

    useEffect(() => {
        console.log("isFirefox", isFirefox);
        console.log("isAndroid", isAndroid);
        if (isFirefox && isAndroid) {
            screen.orientation.unlock();
            const onChange = () => { window.location.reload(); }
            screen.orientation.addEventListener("change", onChange);
            return () => {
                screen.orientation.removeEventListener("change", onChange);
            }
        }
    }, []);

    useEffect(() => {
        setRatio((home.current?.clientWidth || 1) / ((home.current?.clientHeight || 1) * (3618/858)));
        setOffset3Factor((window.innerHeight <= window.innerWidth) ? 2 : Math.round(2 + (1.5 * (window.innerHeight / window.innerWidth))));
    }, [home.current?.clientWidth]);

    const { scrollX, scrollY } = useScroll();
    const scrollXAdditional = useMotionValue(0);
    const scrollYAdditional = useMotionValue(0);
    var newScrollX: MotionValue = useTransform(() => {
        if (!subroot?.current) return 0;

        let limit = (home.current?.clientWidth || 0) > window.innerWidth ?
            (home.current?.clientWidth || window.innerWidth) - window.innerWidth : 0;
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        const scrollSum = scrollX.get() + scrollY.get() + scrollXAdditional.get() + scrollYAdditional.get();

        if (isTouchDevice) {
            if (showSwiper && scrollSum != 0) setShowSwiper(false);
            const smallerDim = Math.min(window.innerWidth, window.innerHeight);
            limit = (home.current?.clientWidth || smallerDim) - smallerDim;
            console.log("isTouchDevice");
            console.log("scrollX", scrollX.get(), "scrollY", scrollY.get());
            console.log("scrollSum", scrollSum, "limit", limit);
            if (scrollX.get() >= limit) {
                window.scrollTo({
                    left: limit,
                    behavior: "instant"
                });
            }
        } else {
            console.log("not touch device")
        }

        if (scrollSum < 0) {
            console.log("Negative scroll - reset");
            window.scrollTo({
                left: 0,
                behavior: "instant"
            });
            scrollXAdditional.set(0);
            scrollYAdditional.set(0);
            return typeof(newScrollX) !== "undefined" ? Math.floor(newScrollX.get() / 2) : 0;
        } else if (scrollSum > limit) {
            console.log("Overscroll", scrollSum, scrollX.get(), scrollY.get(), limit, scrollSum - limit);
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


    // const offset0 = useTransform(() => newScrollX.get() * -0.32);
    // const offset05 = useTransform(() => newScrollX.get() * -0.25);
    const offset15 = useTransform(() => newScrollX.get() * 1.15);
    const offset2 = useTransform(() => newScrollX.get() * 1.35);
    const offset3 = useTransform(() => newScrollX.get() * offset3_factor);

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
        const rootElem = root.current;
        if (!props.ready || !rootElem) return;

        const onHomeWheel = (e: WheelEvent) => {
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            if (isTouchDevice) {
                console.log("isTouchDevice", isTouchDevice);
                scrollXAdditional.set(0);
                scrollYAdditional.set(0);
    
                window.scrollTo({
                    left: 0,
                    top: 0,
                    behavior: "instant"
                });
                return;
            }
            
            const limit = (home.current?.clientWidth || window.innerWidth) - window.innerWidth;
            const { deltaX, deltaY } = e;
    
            // console.log(newScrollX.get(), -limit, home.current?.clientWidth, window.innerWidth);
            if (newScrollX.get() <= -limit && deltaX + deltaY > 0) {
                console.log("BLOCK! A", deltaX + deltaY);
                scrollXAdditional.set(limit);
                scrollYAdditional.set(0);
                window.scrollTo({
                    left: 0,
                    top: 0,
                    behavior: "instant"
                });
            } else if (newScrollX.get() >= -1 && deltaX + deltaY < 0) {
                console.log("BLOCK! B", deltaX + deltaY);
                if (deltaY < 0 && scrollYAdditional.get() + deltaY < 0) scrollYAdditional.set(0);
                if (deltaX < 0 && scrollXAdditional.get() + deltaX < 0) scrollXAdditional.set(0);
                return;
            } else {
                if (deltaY !== 0 && Math.abs(deltaY) > Math.abs(deltaX)) scrollYAdditional.set(scrollYAdditional.get() + deltaY);
                else if (deltaX !== 0) scrollXAdditional.set(scrollXAdditional.get() + deltaX);
                setColumnFocus(false);
                setShowSwiper(false);
                idleAnimRef.current?.stop();
            }
            e.preventDefault();
        };

        rootElem?.addEventListener("wheel", onHomeWheel, { passive: false });
        rootElem?.addEventListener("mousedown", interceptAutoScroll, { passive: false });
        const swiperTimer = setInterval(() => {
            const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
            if (!hasMovedRef.current) {
                if (!isTouchDevice) {
                    const from = scrollXAdditional.get(), to = scrollXAdditional.get() + Math.floor(window.innerWidth / 11);
                    const anim = animate([[scrollXAdditional, to, {
                        duration: 0.9,
                        ease: "easeIn"
                    }], [scrollXAdditional, [to, from], {
                        duration: 0.9,
                        delay: 0.5,
                        ease: "easeInOut"
                    }], [scrollXAdditional, from, {
                        duration: 0,
                        delay: 0.25
                    }]]);
                    idleAnimRef.current = anim;
                    idleAnimRef.current.then(() => {
                        hasMovedRef.current = false;
                        setShowSwiper(false);
                    });
                    setShowSwiper(true);
                } else {
                    setShowSwiper(true);
                }
            } else {
                clearInterval(swiperTimer);
            }
        }, 1750);
        home.current?.focus();
        return () => {
            clearInterval(swiperTimer);
            rootElem?.removeEventListener("wheel", onHomeWheel);
            rootElem?.removeEventListener("mousedown", interceptAutoScroll);
        }
    }, [home, props.ready, scrollXAdditional]);

    useMotionValueEvent(newScrollX, "change", val => {
        if (val < -3) hasMovedRef.current = true;
    });

    useEffect(() => {
        if (firstAlbum.current) {
          const artworkLoaded = new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(resolve, 2500);
            console.log("waiting for artwork", firstAlbum.current?.src);
            if (firstAlbum.current?.complete) {
              resolve();
              console.log("artwork already loaded");
              clearTimeout(timeoutId);
            } else if (firstAlbum.current) {
              firstAlbum.current.onload = () => {
                console.log("artwork loaded");
                clearTimeout(timeoutId);
                resolve();
              };
              firstAlbum.current.onerror = () => {
                reject(new Error('Failed to load artwork'));
              };
            }
          });

          const plantLoaded = new Promise<void>((resolve, reject) => {
            layer0_5.current?.querySelectorAll(`.${styles.plant} img`).forEach((plantImg, i) => {
                const timeoutId = setTimeout(resolve, 2500);
                console.log(`waiting for plant ${i}`)
                const img = plantImg as HTMLImageElement;
                if (!img.complete) {
                    img.onload = () => {
                        resolve();
                        clearTimeout(timeoutId);
                        console.log(`plant ${i} loaded`);
                    };
                    img.onerror = () => {
                        reject(new Error('Failed to load plant img'));
                    };
                } else {
                    console.log(`plant ${i} already loaded`)
                    clearTimeout(timeoutId);
                    resolve();
                }
            });
          });

          const posterLoaded = new Promise<void>((resolve, reject) => {
            layer0.current?.querySelectorAll(`.${styles.poster} img`).forEach((posterImg, i) => {
                console.log(`waiting for poster ${i}`);
                const timeoutId = setTimeout(resolve, 2500);
                const img = posterImg as HTMLImageElement;
                if (!img.complete) {
                    img.onload = () => {
                        resolve();
                        clearTimeout(timeoutId);
                        console.log(`poster ${i} loaded`);
                    };
                    img.onerror = () => {
                        reject(new Error('Failed to load poster img'));
                        console.log("poster error")
                    };
                } else {
                    console.log(`poster ${i} already loaded`)
                    clearTimeout(timeoutId);
                    resolve();
                }
            });
          });

          const scrollToAnchorPromise = new Promise<void>((resolve, reject) => {
            console.log("waiting for anchor scroll");
            const timeoutId = setTimeout(resolve, 2500);
            resolveScrollRef.current = () => {
                resolve();
                clearTimeout(timeoutId);
                console.log("anchor scroll done");
            };
          });
          
          const promisesList = [artworkLoaded, plantLoaded, posterLoaded];
          if (router.asPath.includes("#")) promisesList.push(scrollToAnchorPromise);

          Promise.all(promisesList)
            .then(props.onReady)
            .catch(console.error);
        }
      }, [firstAlbum.current, isPresent, router.asPath, props.ready]);

    const posters = [
        { src: "https://framerusercontent.com/images/XRJGfu2ZZn2mWSL86QVmPhAfBE.jpg", className: styles.leuven, ratio: 440 / 228, parallaxFactor: 120 },
        { src: "https://framerusercontent.com/images/iiwPEYtcgqr0GlVsNBXYW7X8.jpg", className: styles.akerman, ratio: 337 / 296, parallaxFactor: 140 },
        { src: "https://framerusercontent.com/images/HSI69fi5yZ7EAlWBALNdz3stGI.jpg", className: styles.brel, ratio: 337 / 448, parallaxFactor: 170 },
        { src: "https://framerusercontent.com/images/onpDPhhlUWDWDTFRwQ8urTPOXQs.jpg", className: styles.redford, ratio: 582 / 397, parallaxFactor: 120 },
        { src: "https://framerusercontent.com/images/ZUrkjCIHCUv6FqcoUXJw3atquQ.webp", className: styles.cavell, ratio: 2267 / 1704, parallaxFactor: 130 },
        { src: "https://framerusercontent.com/images/smcypGnQ7zED6TKSxE9PpqKBMxQ.jpg", className: styles.congo, ratio: 2267 / 1704, parallaxFactor: 130 },
        { src: "https://framerusercontent.com/images/WiTE1wYTrGK2zx2OVVRi5QGnFg.jpg", className: styles.walenbuiten, ratio: 2267 / 1704, parallaxFactor: 130 },
        { src: "https://framerusercontent.com/images/8euSsKe0GIbfmDH50p4BA8Enozw.jpg", className: styles.stones, ratio: 1, parallaxFactor: 140 },
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
                    <motion.div className={styles.home} key={"home"} ref={home} tabIndex={0} id="home"
                        onKeyDown={handleKeysDown} style={{ translateX: newScrollX, translateZ: 0 }}>
                        <Head>
                            <title>{playbackTitle ? `${isPlaying ? "▶ " : ""}${playbackTitle}` : "Septante Minutes Avec"}</title>
                        </Head>
                        <motion.div key="layer_0" ref={layer0} className={[styles.layer_0, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={isSafari || isIOS ? { translateZ: 0 } : {}}>
                            <div className={styles.ceiling_3} key={"ceiling_3"} />
                            <div className={styles.ceiling_2} key={"ceiling_2"}>
                                {floorKeys.map((i) => (
                                    <div key={`floor_${i}`} style={{ aspectRatio: 3618/858, width: "auto", height: "100svh" }}>
                                        <Image priority={true} src="https://framerusercontent.com/images/N99SQvccncY8lkqgpW8uypkR1E.png" alt="" style={{ transform: `scale(${i % 2 ? -1 : 1}, 1)` }} fill sizes="422svh" />
                                    </div>
                                ))}
                            </div>
                            <div className={styles.ceiling} key={"ceiling"} />
                            <div className={styles.backwall} key={"backwall"}>
                                <BackwallLight className={styles.backwall_light} targetRef={firstPoster} motionValue={newScrollX} key="backwall_light" />
                                <motion.div className={styles.backwall_paint} key={"backwall_paint"} />
                                <div className={styles.posters} key={"posters"}>
                                    {
                                        seasons.map((season, i) => (
                                            <React.Fragment key={season.name + "_invisible00_fragment"}>
                                                <div key={season.name + "_invisible00"} style={{ width: `calc((${layer1.current?.children[i]?.children[0]?.getBoundingClientRect().width || 2000}px - (85svh / 4.5)) / 0.877882)` }} />
                                                {
                                                    <Poster inheritedRef={i == 0 ? firstPoster : undefined} className={[styles.poster, posters[i].className].join(" ")} key={`${season.name}_poster_${i}`}
                                                    poster={posters[i]} isLast={i == seasons.length - 1} motionValue={newScrollX} />
                                                }
                                            </React.Fragment>
                                        ))
                                    }
                                </div>
                            </div>

                            <div className={styles.floor_3} key={"floor_3"} />
                            <div className={styles.floor_2} key={"floor_2"}>
                                {floorKeys.map((i) => (
                                    <div key={`floor_${i}`} style={{ aspectRatio: 3618/858, width: "auto", height: "100svh" }}>
                                        <Image priority={true} src="https://framerusercontent.com/images/N99SQvccncY8lkqgpW8uypkR1E.png" alt="" style={{ transform: `scale(${i % 2 ? -1 : 1}, 1)` }} fill sizes="422svh" />
                                    </div>
                                ))}
                            </div>
                            <div className={styles.floor} key={"floor"} />
                        </motion.div>
                        <motion.div key="layer_0_5" ref={layer0_5} className={[styles.layer_0_5, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={isSafari || isIOS ? { translateZ: 0 } : {}}>
                            {
                                seasons.map((season, i) => (
                                    <React.Fragment key={season.name + "_invisible05_Fragment"}>
                                        <div key={season.name + "_invisible05"} style={{ width: `calc((${layer1.current?.children[i]?.children[0]?.getBoundingClientRect().width || 2000}px - (85svh / 4.5)) * 0.938842)` }} />
                                        {
                                            [
                                                (<React.Fragment key={`deco05_0_${i}`}>
                                                    <PlantD key={`layer05_prop_${i}_PlantD`} className={styles.plant} style={{ zIndex: 2, left: "-5svh" }} motionValue={newScrollX} />
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} motionValue={newScrollX} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_1_${i}`}>
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: undefined }} motionValue={newScrollX} />
                                                    <PlantA key={`layer05_prop_${i}_PlantA`} className={[styles.plant, styles.left_m15].join(" ")} motionValue={newScrollX} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_2_${i}`}>
                                                    <PlantB key={`layer05_prop_${i}_PlantB`} className={[styles.plant, styles.left_m15].join(" ")} motionValue={newScrollX} />
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: undefined }} motionValue={newScrollX} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_3_${i}`}>
                                                    <PlantE key={`layer05_prop_${i}_PlantE`} className={[styles.plant, styles.left_m30].join(" ")} style={{ zIndex: 2, left: "-10svh" }} motionValue={newScrollX} />
                                                    <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: "" }} motionValue={newScrollX} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_4_${i}`}>
                                                        <div key={`layer05_gap0_${i}_div`} className={styles.gap} style={{ width: "calc(55 * var(--unit))" }} />
                                                        <Eggchair key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: undefined }} motionValue={newScrollX} />
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
                                seasons.map((season, i) => (
                                    <Season key={`${season.name}_visible1`} seasonTitle={`SAISON ${season.name}`} chair={Chairs[i % 4]} className={styles.season_frame}>
                                        {season.episodes.toReversed().map((ep: episode, j: number) => (
                                            <HomeAlbum id={`art_${ep.num}`} ref={((i == 0 && j == 0 && !router.asPath.includes("#")) || router.asPath.split("#")[1] === ep.num) ? firstAlbum : null} guest={ep.title} key={`${ep.num}_visible1`} image={ep.img} num={ep.num}
                                                onClick={(e: MouseEvent) => {
                                                    if (e.button != 0) return;
                                                    if (process.env.NODE_ENV === 'production') setAutoplay(ep);
                                                }} />
                                        ))}
                                    </Season>
                                ))
                            }
                        </motion.div>
                        <motion.div key="layer_1_5" ref={layer1_5} className={[styles.layer_1_5, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateX: offset15, ...(isSafari || isIOS ? {translateZ: 0} : {}) }}>
                            <div className={styles.lamps_1_5} key={"lamps_1_5"} >
                                {floorKeys.map((i) => (
                                    <BellLamp key={`lamp_1_5_${i}`} className={styles.lamp} />
                                ))}
                            </div>
                        </motion.div>
                        <motion.div key="layer_2" ref={layer2} className={[styles.layer_2, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateX: offset2, ...(isSafari || isIOS ? {translateZ: 0} : {}) }}>
                            <div className={styles.lamps_2} key={"lamps_2"}>
                                {floorKeys.map((i) => (
                                    <BellLamp key={`lamp_2_${i}`} className={styles.lamp} />
                                ))}
                            </div>
                        </motion.div>
                        {!isMobile && <div key="layer_3" className={[styles.layer, styles.layer_3_wrapper].join(" ")}>
                            <motion.div ref={layer3} className={[styles.layer_3, styles.layer].join(" ")} style={{ translateX: offset3, ...(isSafari || isIOS ? {translateZ: 0} : {}) }}>
                            <PlantA2 key={`layer3_prop_-1_PlantA2`} className={[styles.plant_front, columnFocus ? styles.blurReady : styles.blur8].join(" ")} />
                                {floorKeys.slice(0, Math.floor(floorKeys.length / (3.6 / offset3_factor))).map((i) => (
                                    <React.Fragment key={`layer3_deco_${i}`}>
                                        <FrontColumn key={`layer3_prop_${i}_FrontColumn`} className={[styles.front_column, columnFocus ? "" : styles.blur8].join(" ")}
                                            pic={FrontPosters[i % 4].img} subtitle={FrontPosters[i % 4].text} ratio={FrontPosters[i % 4].ratio} date={FrontPosters[i % 4].date} blur={FrontPosters[i % 4].blurDataUrl}
                                            onMouseMove={() => { setColumnFocus(true) }} onMouseLeave={() => { setColumnFocus(false) }} />
                                        <PlantA2 key={`layer3_prop_${i}_PlantA2`} sizes="89svmin" className={[styles.plant_front, columnFocus ? styles.blurReady : styles.blur8].join(" ")} />                                        
                                    </ React.Fragment>
                                ))}
                            </motion.div>
                        </div>}
                        <SwipeAnim play={showSwiper} className={styles.swipe_anim} key={"swipe_anim"} />
                    </motion.div>
                </div>
                <ScrollToAnchor move={(x: number) => {
                    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                    if (x > 0) {
                        x = Math.min(x, (home.current?.clientWidth || window.innerWidth) - window.innerWidth);
                        if (isTouchDevice) {
                            window.scrollBy({
                                left: x / 2,
                                behavior: "instant"
                            });
                        } else {
                            scrollXAdditional.set(x);
                        }
                        // console.log("scrolled", x);
                    }
                    hasMovedRef.current = false;
                    if (resolveScrollRef.current) resolveScrollRef.current();
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
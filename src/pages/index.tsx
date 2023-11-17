'use client';

import styles from "./index.module.css";
import React, {
    useState,
    useRef,
    useEffect,
    FC,
} from "react";
import { motion, useTransform, useMotionValue, useScroll } from "framer-motion";
import Image from "next/image";

import Season_, { Chairs } from "../framer/Season-pOfC.js";
import HomeAlbum_ from "../framer/HomeAlbum-WCxn.js";
import BellLamp_ from "../framer/BellLamp.js";
import Eggchair_ from "../framer/Eggchair.js";
import PlantA_ from "../framer/Plant_0.js";
import PlantB_ from "../framer/Plant_1.js";
import PlantC_ from "../framer/Plant_2.js";
import FrontColumn_ from "../framer/front-column-h3ym.js";

import ScrollToAnchor from "../utils/scroll_to_anchor";
import data from "../utils/tempdata.js";

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
    // const [animateY, setAnimateY] = useState<AnimationPlaybackControls | undefined>(undefined);
    // const [targetAnimateY, setTargetAnimateY] = useState<number | undefined>(undefined);
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
    }, [home]);

    const { scrollX } = useScroll();
    const scrollXAdditional = useMotionValue(0);
    const scrollYAdditional = useMotionValue(0);
    const newScrollX = useTransform(() => {
        if (!subroot?.current) return 0;

        if (Math.abs(scrollX.get()) >= 1) {
            console.log("scrollX not null - reset", scrollX.get(), subroot.current?.scrollWidth / 2);
            window.scrollTo({
                left: 0,
                behavior: "instant"
            });
        }

        const scrollSum = scrollXAdditional.get() + scrollYAdditional.get();
        if (scrollSum < 0) {
            console.log("Negative scroll - reset");
            scrollXAdditional.set(0);
            scrollYAdditional.set(0);
            return 0;
        }

        if (typeof window === "undefined") {
            console.log("undefined window", -scrollSum);
            return -scrollSum
        };
        const limit = (home.current?.clientWidth || window.innerWidth) - window.innerWidth;
        const output = Math.min(-Math.min(scrollSum, limit), 0);
        console.log("newScrollX:", output);
        return output;
    });
    const offset0 = useTransform(() => newScrollX.get() * 0.15);
    const offset05 = useTransform(() => newScrollX.get() * 0.25);
    const offset15 = useTransform(() => newScrollX.get() * -1.15);
    const offset2 = useTransform(() => newScrollX.get() * -1.35);
    const offset3 = useTransform(() => newScrollX.get() * -2);

    const onHomeWheel = (e: WheelEvent) => {
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        const limit = (home.current?.clientWidth || 5000) - window.innerWidth;

        // console.log(newScrollX.get(), -limit, home.current?.clientWidth, window.innerWidth);
        if (newScrollX.get() <= -limit && e.deltaX + e.deltaY > 0) {
            console.log("BLOCK! A", e.deltaX + e.deltaY);
        } else if (newScrollX.get() >= 0 && e.deltaX + e.deltaY < 0) {
            console.log("BLOCK! B", e.deltaX + e.deltaY);
        } else {
            if (e.deltaX !== 0) scrollXAdditional.set(scrollXAdditional.get() + e.deltaX);
            else if (e.deltaY !== 0) scrollYAdditional.set(scrollYAdditional.get() + e.deltaY);
        }
        e.preventDefault();
    };

    const posters = [
        (<div className={[styles.poster, styles.leuven].join(" ")}>
            <Image className={styles.leuven} alt="" src="https://framerusercontent.com/images/XRJGfu2ZZn2mWSL86QVmPhAfBE.jpg" sizes="40vw" fill />
        </div>),
        (<div className={[styles.poster, styles.akerman].join(" ")}>
            <Image className={styles.akerman} alt="" src="https://framerusercontent.com/images/iiwPEYtcgqr0GlVsNBXYW7X8.jpg" sizes="40vw" fill />
        </div>),
        (<div className={[styles.poster, styles.brel].join(" ")}>
            <Image className={styles.leuven} alt="" src="https://framerusercontent.com/images/4x11RpHpM5DEUM2LRHjPYitFo.jpg" sizes="40vw" fill />
        </div>),
        (<div className={[styles.poster, styles.redford].join(" ")}>
            <Image className={styles.leuven} alt="" src="https://framerusercontent.com/images/onpDPhhlUWDWDTFRwQ8urTPOXQs.jpg" sizes="40vw" fill />
        </div>),
        (<div className={[styles.poster, styles.stones].join(" ")}>
            <Image className={styles.leuven} alt="" src="https://framerusercontent.com/images/8euSsKe0GIbfmDH50p4BA8Enozw.jpg" sizes="40vw" fill />
        </div>)
    ];

    return (
        <div ref={subroot} className={styles.home_subroot}>
            <div ref={root} className={styles.home_root}>
                <motion.div className={styles.home} ref={home} style={{ translateX: newScrollX }}>
                    <motion.div key="layer_0" ref={layer0} className={[styles.layer_0, styles.layer].join(" ")} style={{ translateX: offset0 }}>
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
                                            <Season key={season.name + "_invisible"} className={styles.season_frame} chair={Chairs[i % 4]} style={{ visibility: "hidden" }}>
                                                {season.episodes.reverse().map((ep: episode) => (
                                                    <HomeAlbum key={ep.num} image={""} num={ep.num} />
                                                ))}
                                            </Season>
                                            {
                                                posters[i]
                                            }
                                        </>
                                    ))
                                }
                            </div>
                            <div className={styles.backwall_light}>
                                <Image loading="eager" alt="" src="https://framerusercontent.com/images/FsKB3GEHFAPqgBfbeEkGrIb6lA.png" fill sizes="461vw" />
                            </div>
                            <div className={styles.backwall_paint} />
                        </div>

                        <div className={styles.floor_3} />
                        <div className={styles.floor_2}>
                            <Image loading="eager" src="https://framerusercontent.com/images/N99SQvccncY8lkqgpW8uypkR1E.png" alt="" fill sizes={`${home.current?.clientWidth}px`} />
                        </div>
                        <div className={styles.floor} />
                    </motion.div>
                    <motion.div key="layer_0_5" ref={layer0_5} className={[styles.layer_0_5, styles.layer].join(" ")}
                    style={{ translateX: offset05 }}>
                        <div className={styles.gap} style={{ width: "15vh" }} />
                        {
                            [...seasons].reverse().map((season, i) => (
                                <>
                                    <Season key={season.name + "_invisible"} className={styles.season_frame} chair={Chairs[i % 4]} style={{ visibility: "hidden" }}>
                                        {season.episodes.reverse().map((ep: episode) => (
                                            <HomeAlbum key={ep.num} image={""} num={ep.num} />
                                        ))}
                                    </Season>
                                    {
                                        [
                                            (<>
                                                <PlantA className={styles.plant} style={{ zIndex: 2 }}/>
                                                <Eggchair className={styles.eggchair} style={{ left: "-20vh" }}/>
                                            </>),
                                            (<>
                                                <Eggchair className={styles.eggchair} style={{ zIndex: 2 }} />
                                                <PlantB className={styles.plant} style={{ left: "-15vh" }} />
                                            </>),
                                            (<>
                                                <Eggchair className={styles.eggchair} style={{ zIndex: 2 }} />
                                                <PlantA className={styles.plant} style={{ left: "-15vh" }} />
                                            </>)
                                        ][i % 3]
                                    }
                                    <div className={styles.gap} style={{ width: "25vh" }} />
                                </>
                            ))
                        }
                    </motion.div>
                    <motion.div key="layer_1" ref={layer1} className={[styles.layer_1, styles.layer].join(" ")}>
                        {
                            [...seasons].reverse().map((season, i) => (
                                <Season key={season.name} seasonTitle={`SAISON ${season.name}`} chair={Chairs[i % 4]} className={styles.season_frame}>
                                    {season.episodes.reverse().map((ep: episode) => (
                                        <HomeAlbum id={`art_${ep.num}`} key={ep.num} image={ep.img} num={ep.num} />
                                    ))}
                                </Season>
                            ))
                        }
                    </motion.div>
                    <motion.div key="layer_1_5" ref={layer1_5} className={[styles.layer_1_5, styles.layer].join(" ")} style={{ translateX: offset15 }}>
                        <div className={styles.lamps_1_5} >
                            <div className={styles.gap} style={{ width: "33vh" }} />
                            <BellLamp className={styles.lamp} />
                            <BellLamp className={styles.lamp} />
                            <BellLamp className={styles.lamp} />
                            <BellLamp className={styles.lamp} />
                        </div>
                    </motion.div>
                    <motion.div key="layer_2" ref={layer2} className={[styles.layer_2, styles.layer].join(" ")} style={{ translateX: offset2 }}>
                        <div className={styles.lamps_2} >
                            <BellLamp className={styles.lamp} />
                            <BellLamp className={styles.lamp} />
                            <BellLamp className={styles.lamp} />
                        </div>
                    </motion.div>
                    <div key="layer_3" ref={layer3} className={[styles.layer, styles.layer_3_wrapper].join(" ")}>
                        <motion.div key="layer_3" ref={layer3} className={[styles.layer_3, styles.layer].join(" ")} style={{ translateX: offset3 }}>
                            <div className={styles.gap} style={{ width: "155vh" }} />
                            <PlantC className={styles.plant_front} />
                            <div className={styles.gap} style={{ width: "282vh" }} />
                            <FrontColumn className={styles.front_column} />
                        </motion.div>
                    </div>
                </motion.div>
            </div>
            <div />
            <ScrollToAnchor />
        </div>
    );
}

type key = "1" | "2"; // Etc.
type episode = { img: string, num: string }
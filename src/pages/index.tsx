import styles from "./index.module.css";
import React, {
  useState,
  useRef,
  useEffect,
  FC
} from "react";
import simpleParallax from 'simple-parallax-js';
import HorizontalScroll from 'react-scroll-horizontal'
import Image from "next/image";

import Season_, { Chairs } from "../framer/Season-pOfC.js";
import HomeAlbum_ from "../framer/HomeAlbum-WCxn.js";
import BellLamp_ from "../framer/BellLamp.js";
import Eggchair_ from "../framer/Eggchair.js";
import PlantA_ from "../framer/Plant_0.js";
import PlantB_ from "../framer/Plant_1.js";
import PlantC_ from "../framer/Plant_2.js";
import FrontColumn_ from "../framer/front-column-h3ym.js";
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

    return (
        <HorizontalScroll className={styles.home} reverseScroll pageLock>
            <div className={[styles.layer_0, styles.layer].join(" ")}>
                <div className={styles.ceiling_3} />
                <div className={styles.ceiling_2} />
                <div className={styles.ceiling} />
                <div className={styles.backwall}>
                    <div className={styles.posters}>
                        <div className={[styles.poster, styles.leuven].join(" ")}>
                            <Image className={styles.leuven} alt="" src="/img/leuven.png" fill />
                        </div>
                        <div className={[styles.poster, styles.brel].join(" ")}>
                            <Image className={styles.leuven} alt="" src="/img/brel.png" fill />
                        </div>
                        <div className={[styles.poster, styles.redford].join(" ")}>
                            <Image className={styles.leuven} alt="" src="/img/redford.png" fill />
                        </div>
                        <div className={[styles.poster, styles.stones].join(" ")}>
                            <Image className={styles.leuven} alt="" src="/img/stones.png" fill />
                        </div>
                    </div>
                    <div className={styles.backwall_light}>
                        <Image alt="" src="/img/BackWallLight.png" fill />
                    </div>
                    <div className={styles.backwall_paint} />
                </div>
                
                <div className={styles.floor_3} />
                <div className={styles.floor_2} />
                <div className={styles.floor} />
            </div>
            <div className={[styles.layer_0_5, styles.layer].join(" ")}>
                <div className={styles.gap} style={{ width: "80vh" }} />
                <Eggchair className={styles.eggchair} />
                <div className={styles.gap} style={{ width: "55vh" }} />
                <PlantA className={styles.plant} />
                <div className={styles.gap} style={{ width: "87vh" }} />
                <Eggchair className={styles.eggchair} style={{ zIndex: 2 }} />
                <PlantB className={styles.plant} style={{ left:"-15vh"}} />
            </div>
            <div className={[styles.layer_1, styles.layer].join(" ")}>
                {
                    [...seasons].reverse().map((season, i) => (
                        <Season key={season.name} seasonTitle={`SAISON ${season.name}`} chair={Chairs[i % 4]} className={styles.season_frame}>
                            {season.episodes.reverse().map((ep: episode) => (
                                <HomeAlbum key={ep.num} image={ep.img} num={ep.num} />
                            ))}
                        </Season>
                    ))
                }
            </div>
            <div className={[styles.layer_1_5, styles.layer].join(" ")}>
                <div className={styles.lamps_1_5} >
                    <BellLamp className={styles.lamp} />
                    <BellLamp className={styles.lamp} />
                    <BellLamp className={styles.lamp} />
                </div>
            </div>
            <div className={[styles.layer_2, styles.layer].join(" ")}>
                <div className={styles.lamps_2} >
                    <BellLamp className={styles.lamp} />
                    <BellLamp className={styles.lamp} />
                    <BellLamp className={styles.lamp} />
                </div>
            </div>
            <div className={[styles.layer_3, styles.layer].join(" ")}>
                <div className={styles.gap} style={{ width: "202vh" }} />
                <FrontColumn className={styles.front_column} />
                <div className={styles.gap} style={{ width: "85vh" }} />
                <PlantC className={styles.plant_front} />
            </div>
        </HorizontalScroll>
    );
}

type key = "1" | "2"; // Etc.
type episode = { img: string, num: string }
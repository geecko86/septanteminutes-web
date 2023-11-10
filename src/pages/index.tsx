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
import data from "../utils/tempdata.js";

export default function Home() {

    const Season: FC<any> = Season_;
    const HomeAlbum: FC<any> = HomeAlbum_;

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
            <div className={[styles.layer_1, styles.layer].join(" ")}>
                {
                    [...seasons].reverse().map((season, i) => (
                        <Season key={season.name} seasonTitle={`SAISON ${season.name}`} chair={Chairs[i % 4]} className={styles.season_frame}>
                            {season.episodes.reverse().map((ep: episode) => (
                                <HomeAlbum key={ep.num} image={ep.img} />
                            ))}
                        </Season>
                    ))
                }
            </div>
        </HorizontalScroll>
    );
}

type key = "1" | "2"; // Etc.
type episode = { img: string, num: string }
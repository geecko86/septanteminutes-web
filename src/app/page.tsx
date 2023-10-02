"use client";

import styles from "./page.module.css";
import React, { useState, useRef, useEffect, cloneElement } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useEventListener } from 'usehooks-ts'
import createScrollSnap from "scroll-snap";

import Chair from "https://framer.com/m/Chair-DLhl.js@JuWjXbhwOYQagHrgKa8w";
import Notebook from "https://framer.com/m/Notebook-Large-NSPa.js";
import Pen from "https://framer.com/m/Pen-y9p1.js@0TKtKBOXn6QqbuYWU4Dd";
import PostIt from "https://framer.com/m/Post-It-woNB.js@VbZ89G1tiRk4tmFeh90v";
import ImagedPostIt from "https://framer.com/m/Imaged-Post-It-1vlf.js@awriGhqD00eedeeh1NVA";
import Headphones from "https://framer.com/m/Headphones-p7iC.js@oQAzVYDXOsYSKncaRb32";
import Phone from "https://framer.com/m/Phone-LGnb.js@zfhXvJfaEcaTAAB8pSKH";
import Camera from "https://framer.com/m/Camera-2YBb.js@ml9NEzDk9cuHo9UjgqQs";

import RecordPlayer from "./components/RecordPlayer";
import VinylAlbum, { ShadowAlbum } from "./components/VinylAlbum";
import NotebookOverlay from "./components/NotebookOverlay";
import data from "../utils/tempdata.js";

export default function EpisodeTable() {
  const { episodes } = data;

  const episodePage = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    container: episodePage
  });

  useMotionValueEvent(scrollYProgress, "change", value => {
    // console.log(value);
  });

  const vinyls = Array.from(
    { length: Object.keys(episodes).length },
    (v, k) => episodes[(k + 1).toString() as key]
  );

  const [floatingNode, setFloatingNode] = useState(false);
  const [timeoutId, setTimeoutId] = useState<any>(null);
  const [selectedEpisode, setSelectedEpisode] = useState(vinyls.length - 1);
  const [selectedPosition, setSelectedPosition] = useState(0);

  const { notebookOverlayComponent, referenceProps, refs } = NotebookOverlay({
    setFloatingNode,
  });

  useEffect(() => {
    const element = episodePage.current;
    if (element) {
      const snapElement = createScrollSnap(element as HTMLDivElement, {
        snapDestinationY: "100vh",
        timeout: 100,
        threshold: 0.4
      }, () => {
        const selectedPosition = Math.min(Math.floor(scrollYProgress.get() * vinyls.length), vinyls.length - 1);
        const currentEpisode = vinyls.length - selectedPosition;
        // console.log(`Selected child #${selectedPosition}`, `episode #${currentEpisode}`);
        setSelectedPosition(selectedPosition);
        setSelectedEpisode(currentEpisode);
      }).bind();
    }
  }, [episodePage]);

  useEventListener('resize', () => {
    if (timeoutId) clearTimeout(timeoutId);
    const newId = setTimeout(() => {
      const destination = selectedPosition * ((episodePage.current)?.clientHeight || 0);
      // console.log("scroll:", selectedPosition, ((episodePage.current)?.clientHeight || 0), destination);
      episodePage.current?.scroll({top: destination, behavior: "instant"});
    }, 300);
    setTimeoutId(newId);
  });

  return (
    <div
      ref={episodePage}
      className={`episode_page`}
    >
      {floatingNode &&
        cloneElement(notebookOverlayComponent, { setFloatingNode })}
      <motion.div className={styles.main}>
        <div className={styles.floor}>
          <Chair className={styles.chair} />
          <div className={styles.invisiblefill} />
        </div>
        <div className={styles.table}>
          <div className={styles.table_shadow_box} >
            <motion.div className={styles.albums}>
              {vinyls.map((_, index) => (
                <ShadowAlbum
                  key={index}
                  image=""
                  total={vinyls.length}
                  position={vinyls.length - index - 1}
                  scrollYProgress={scrollYProgress}
                />
              ))}
            </motion.div>
          </div>
          <Headphones className={styles.headphones} />
          <Pen className={styles.pen} />
          <Notebook
            className={styles.notebook}
            ref={refs.setReference}
            {...referenceProps}
          />
          <Phone className={styles.phone} />
          <Camera className={styles.camera} />
          <RecordPlayer className={styles.player} />
          <div className={styles.postitnotes}>
            <ImagedPostIt
              className={styles.postit}
              title={"\nPage\nd'accueil"}
            />
            <PostIt
              className={styles.postit}
              title={"S'abonner"}
              {...referenceProps}
            />
            <PostIt
              className={styles.postit}
              title={"Contact"}
              onClick={() =>
                window.open("mailto:contact@septanteminutes.be", "_blank")
              }
            />
          </div>
          <motion.div className={styles.albums}>
            {vinyls.map((episode, index) => (
              <VinylAlbum
                key={index}
                image={episode["img"] || ""}
                total={vinyls.length}
                position={vinyls.length - index - 1}
                scrollYProgress={scrollYProgress}
              />
            ))}
          </motion.div>
        </div>
      </motion.div>
      {vinyls.toReversed().map((v, i) => (
        <div className={styles.section} key={i}>
          {/* <p>{v.title}</p> */}
        </div>
      ))}
    </div>
  );
}

type key = "1" | "2"; // Etc.

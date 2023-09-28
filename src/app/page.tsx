"use client";

import styles from "./page.module.css";
import React, { useState, useRef, useEffect, cloneElement } from "react";
import { motion, useScroll } from "framer-motion";
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
import VinylAlbum from "./components/VinylAlbum";
import NotebookOverlay from "./components/NotebookOverlay";
import data from "../utils/tempdata.js";

export default function EpisodeTable() {
  // const { scrollYProgress } = useScroll();
  const episodePage = useRef<HTMLDivElement>(null);
  const [floatingNode, setFloatingNode] = useState(false);

  const { episodes } = data;

  const vinyls = Array.from(
    { length: Object.keys(episodes).length },
    (v, k) => episodes[(k + 1).toString() as key]
  ).slice(0, 5);

  const { notebookOverlayComponent, referenceProps, refs } = NotebookOverlay({
    setFloatingNode,
  });
  const pageSize = (vinyls.length - 1) * 100;

  const bindScrollSnap = () => {
    const element = episodePage.current;
    const snapElement = createScrollSnap(element as HTMLDivElement, {
      snapDestinationY: "100vh"
    }, () => {console.log("end")});

    snapElement.bind();
  }

  useEffect(() => {
    if (episodePage.current) bindScrollSnap();
  }, [episodePage]);

  return (
    <div
      ref={episodePage}
      className={`episode_table`}
      style={{ height: `${pageSize}vh` }}
    >
      {/* {floatingNode &&
        cloneElement(notebookOverlayComponent, { setFloatingNode })}
      <motion.div className={styles.page}>
        <div className={styles.floor}>
          <Chair className={styles.chair} />
          <div className={styles.invisiblefill} />
        </div>
        <div className={styles.table}>
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
      </motion.div> */}
      { vinyls.map((v, i) => (
        <div onClick={() => {/* goto(i * 2) */}} className={styles.section} key={i} style={{ backgroundImage: `url(${v.img})` }}>{`Screen ${i}`}</div>
      ))}
    </div>
  );
}

type key = "1" | "2"; // Etc.

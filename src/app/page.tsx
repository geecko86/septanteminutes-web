"use client";

import styles from "./page.module.css";
import React, { useState, useRef, useEffect, useCallback, cloneElement } from "react";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useEventListener } from 'usehooks-ts';
import createScrollSnap from "scroll-snap";

import Chair from "https://framer.com/m/Chair-DLhl.js@JuWjXbhwOYQagHrgKa8w";
import Notebook from "https://framer.com/m/Notebook-Large-NSPa.js";
import Pen from "https://framer.com/m/Pen-y9p1.js@0TKtKBOXn6QqbuYWU4Dd";
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

  const vinyls = Array.from(
    { length: Object.keys(episodes).length },
    (v, k) => episodes[(k + 1).toString() as key]
  );

  const [floatingNode, setFloatingNode] = useState(false);
  const [timeoutId, setTimeoutId] = useState<any>(null);
  const [selectedEpisode, setSelectedEpisode] = useState(vinyls.length - 1);
  const [selectedPosition, setSelectedPosition] = useState(0);

  const episodePage = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const shadows = useRef<HTMLDivElement>(null);

  const { notebookOverlayComponent, referenceProps, refs } = NotebookOverlay({
    setFloatingNode,
  });

  const { scrollYProgress } = useScroll({
    container: episodePage
  });

  const getCurrentPosition = useCallback(() => Math.min(Math.floor(scrollYProgress.get() * vinyls.length), vinyls.length - 1), [scrollYProgress, vinyls.length]);

  useEffect(() => {
    const element = episodePage.current;
    if (element) {
      createScrollSnap(element as HTMLDivElement, {
        snapDestinationY: "100vh",
        timeout: 0,
        duration: 0,
        threshold: 0.4
      }, () => {
        const currentPosition = getCurrentPosition();
        const currentEpisode = currentPosition;
        console.log(`Selected child #${currentPosition}`, `episode #${currentEpisode}`);
        setSelectedPosition(currentPosition);
        setSelectedEpisode(currentEpisode);
      }).bind();
      mainRef.current?.focus();
    }
  }, [episodePage, getCurrentPosition]);

  useEventListener('resize', () => {
    if (timeoutId) clearTimeout(timeoutId);
    const newId = setTimeout(() => {
      const destination = selectedPosition * ((episodePage.current)?.clientHeight || 0);
      // console.log("scroll:", selectedPosition, ((episodePage.current)?.clientHeight || 0), destination);
      episodePage.current?.scroll({ top: destination, behavior: "instant" });
    }, 300);
    setTimeoutId(newId);
  });

  const handleArrows = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.keyCode) {
      case 38: // up arrow
        if (selectedPosition == 0) return;
        episodePage.current?.scrollBy({ top: ((episodePage.current)?.clientHeight || 0) * -0.75, behavior: "instant" })
        break;
      case 40: // down arrow
        if (selectedPosition == vinyls.length - 1) return;
        episodePage.current?.scrollBy({ top: ((episodePage.current)?.clientHeight || 0) * 0.75, behavior: "instant" })
        break;
      case 13: // enter key
        // TODO
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={episodePage}
      className={`episode_page`}
    >
      {floatingNode &&
        cloneElement(notebookOverlayComponent, { setFloatingNode })}
      <motion.div className={styles.main} ref={mainRef}
        onKeyDown={e => handleArrows(e)} tabIndex={0}>
        <div className={styles.floor}>
          <Chair className={styles.chair} />
          <div className={styles.invisiblefill} />
        </div>
        <div className={styles.table}>
          <div className={styles.table_shadow_box} >
            <motion.div className={styles.albums} ref={shadows} >
              {vinyls.map((_, index) => (
                <ShadowAlbum
                  key={index}
                  image=""
                  total={vinyls.length}
                  position={index}
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
            <ImagedPostIt
              classNam
              className={[styles.postit, styles.download_postit].join(' ')}
              title={"Télécharger"}
              onClick={() => {}}
            />
            <ImagedPostIt
              className={[styles.postit, styles.contact_postit].join(' ')}
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
                onMouseEnter={e => {
                  shadows.current?.children[index].setAttribute("hover", "true");
                }}
                onMouseLeave={e => {
                  shadows.current?.children[index].removeAttribute("hover");
                }}
                image={episode["img"] || ""}
                total={vinyls.length}
                position={index}
                scrollYProgress={scrollYProgress}
              />
            ))}
          </motion.div>
        </div>
      </motion.div>
      {vinyls.map((v, i) => (
        <div className={styles.section} key={i}>
          {/* <p>{v.title}</p> */}
        </div>
      ))}
    </div>
  );
}

type key = "1" | "2"; // Etc.

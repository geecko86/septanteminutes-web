import styles from "./episode.module.css";
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  cloneElement,
  FC,
} from "react";
import { useRouter } from "next/router";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useEventListener } from "usehooks-ts";
import createScrollSnap from "scroll-snap";
import type {
  InferGetStaticPropsType,
  GetStaticProps,
  GetStaticPaths,
} from 'next'

import Chair_ from "../../framer/Chair-DLhl.js";
import Notebook_ from "../../framer/Notebook-Large-POCp.js";
import Pen_ from "../../framer/Pen-y9p1.js";
import Headphones_ from "../../framer/Headphones-p7iC.js";
import ImagedPostIt_ from "../../framer/Imaged-Post-It-1vlf.js";
import Phone from "https://framer.com/m/Phone-LGnb.js@zfhXvJfaEcaTAAB8pSKH";
import Camera from "https://framer.com/m/Camera-2YBb.js@ml9NEzDk9cuHo9UjgqQs";

import RecordPlayer from "../../components/RecordPlayer";
import VinylAlbum, { ShadowAlbum } from "../../components/VinylAlbum";
import NotebookOverlay from "../../components/NotebookOverlay";
import data from "../../utils/tempdata.js";

export default function EpisodeTable() {
  const { episodes } = data;
  const router = useRouter();

  const vinyls = Array.from(
    { length: Object.keys(episodes).length },
    (v, k) => episodes[(k + 1).toString() as key]
  );

  const [floatingNode, setFloatingNode] = useState(false);
  const [timeoutId, setTimeoutId] = useState<any>(null);
  const [selectedPosition, setSelectedPosition] = useState(0);
  const [mayAnimate, setMayAnimate] = useState(false);

  const episodePage = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const shadows = useRef<HTMLDivElement>(null);
  
  const [episodeNumParam, setEpisodeNumParam] = useState(vinyls.length - 1);
  const [selectedEpisode, setSelectedEpisode] = useState(vinyls.length - 1);

  const { notebookOverlayComponent, referenceProps, refs } = NotebookOverlay({
    setFloatingNode,
    title: vinyls[selectedEpisode].title.split(/\s?(-|–)\s?/g)[2],
    subtitle: `Avec ${vinyls[selectedEpisode].title.split(/\s?(-|–)\s?/g)[0]}`,
    desc: vinyls[selectedEpisode].desc,
  });

  const { scrollYProgress, scrollY } = useScroll({
    container: episodePage,
  });

  const getCurrentPosition = useCallback(
    () =>
      Math.min(
        Math.floor(scrollYProgress.get() * vinyls.length),
        vinyls.length - 1
      ),
    [scrollYProgress, vinyls.length]
  );

  useEffect(() => {
    const selectedEp = router.query.episodeNum ? Math.min(Number(router.query.episodeNum) - 1, vinyls.length - 1) : vinyls.length - 1;
    setEpisodeNumParam(selectedEp);
    setSelectedEpisode(selectedEp)
  }, [router.query.episodeNum, vinyls.length]);

  useEffect(() => {
    const element = episodePage.current;
    if (element) {
      createScrollSnap(
        element as HTMLDivElement,
        {
          snapDestinationY: "100vh",
          timeout: 0,
          duration: 0,
          threshold: 0.4,
        },
        () => {
          const currentPosition = getCurrentPosition();
          const currentEpisode = vinyls.length - currentPosition - 1;
          // console.log(
          //   `Selected child #${currentPosition}`,
          //   `episode #${currentEpisode}`
          // );
          setSelectedPosition(currentPosition);
          setSelectedEpisode(currentEpisode);
          const newUrl = `${window.location.origin}/${
            currentEpisode + 1
          }`;
          window.history.replaceState({ path: newUrl }, "", newUrl);
        }
      ).bind();
      mainRef.current?.focus();
    }
  }, [episodePage, getCurrentPosition, vinyls.length]);

  const scroll = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      if (node.offsetTop === 0) {
        setMayAnimate(true);
      } else {
        episodePage.current?.scrollTo({
          top: node.offsetTop,
          behavior: "instant",
        });
      }
    }
  }, []);

  useMotionValueEvent(scrollY, "change", (y) => {
    if (episodeNumParam >= vinyls.length - 1) {
      setMayAnimate(true);
    } else if (y === window.innerHeight * (vinyls.length - episodeNumParam)) {
      setTimeout(() => setMayAnimate(true), 350);
    }
  });

  useEventListener("resize", () => {
    if (timeoutId) clearTimeout(timeoutId);
    const newId = setTimeout(() => {
      const destination =
        selectedPosition * (episodePage.current?.clientHeight || 0);
      // console.log("scroll:", selectedPosition, ((episodePage.current)?.clientHeight || 0), destination);
      episodePage.current?.scroll({ top: destination, behavior: "instant" });
    }, 300);
    setTimeoutId(newId);
  });

  const handleArrows = (e: React.KeyboardEvent<HTMLDivElement>) => {
    switch (e.keyCode) {
      case 38: // up arrow
        if (selectedPosition == 0) return;
        episodePage.current?.scrollBy({
          top: (episodePage.current?.clientHeight || 0) * -0.75,
          behavior: "instant",
        });
        break;
      case 40: // down arrow
        if (selectedPosition == vinyls.length - 1) return;
        episodePage.current?.scrollBy({
          top: (episodePage.current?.clientHeight || 0) * 0.75,
          behavior: "instant",
        });
        break;
      case 13: // enter key
        // TODO
        break;
      default:
        break;
    }
  };

  const Chair: FC<any> = Chair_;
  const Notebook: FC<any> = Notebook_;
  const Pen: FC<any> = Pen_;
  const Headphones: FC<any> = Headphones_;
  const ImagedPostIt: FC<any> = ImagedPostIt_;

  return (
    <div ref={episodePage} className={`episode_page`}>
      {cloneElement(notebookOverlayComponent, { setFloatingNode })}
      <motion.div
        className={styles.main}
        ref={mainRef}
        onKeyDown={(e) => handleArrows(e)}
        tabIndex={0}
      >
        <div className={styles.floor}>
          <Chair className={styles.chair} />
          <div className={styles.invisiblefill} />
        </div>
        <div className={styles.table}>
          <div className={styles.table_shadow_box}>
            <motion.div className={styles.albums} ref={shadows}>
              {vinyls.map((_, index) => (
                <ShadowAlbum
                  key={index}
                  image=""
                  total={vinyls.length}
                  position={index}
                  scrollYProgress={scrollYProgress}
                  mayAnimate={mayAnimate}
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
              className={[styles.postit, styles.home_postit].join(" ")}
              title={"Accueil"}
              onClick={() => {}}
            />
            <ImagedPostIt
              className={[styles.postit, styles.download_postit].join(" ")}
              title={"Télécharger"}
              onClick={() => {}}
            />
            <ImagedPostIt
              className={[styles.postit, styles.contact_postit].join(" ")}
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
                alt={episode["title"]}
                total={vinyls.length}
                position={index}
                scrollYProgress={scrollYProgress}
                mayAnimate={mayAnimate}
              />
            ))}
          </motion.div>
        </div>
      </motion.div>
      {vinyls.map((v, i) => (
        <div
          className={styles.section}
          key={i}
          ref={i === vinyls.length - (episodeNumParam + 1) ? scroll : null}
        >
          {/* <p>{v.title}</p> */}
        </div>
      ))}
    </div>
  );
}

type key = "1" | "2"; // Etc.
 
export const getStaticPaths = (async () => {
  const paths = Array.from(Array(100).keys()).map((i) => ({
    params: { episodeNum: `${i}` },
  }));
  return {
    paths: paths,
    fallback: false // anything not included will 404
  }
}) satisfies GetStaticPaths
 
export const getStaticProps = (async (context) => {
  return { props: { } }
}) satisfies GetStaticProps<{
}>;
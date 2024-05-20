import styles from "./episode.module.css";
import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  cloneElement,
  FC,
} from "react";
import { motion, useScroll, animate, useMotionValueEvent, usePresence } from "framer-motion";
import { useEventListener } from "usehooks-ts";
import createScrollSnap from "scroll-snap";
import { BottomSheet } from 'react-spring-bottom-sheet'
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import type {
  GetStaticProps,
  GetStaticPaths,
} from 'next';

import { Pen as Pen_, Chair as Chair_, Headphones as Headphones_ } from "../framer/ImageWrapper";
import Notebook_ from "../framer/Notebook-Large-POCp.js";
import ImagedPostIt_ from "../framer/Imaged-Post-It-1vlf.js";

import RecordPlayer from "../components/RecordPlayer";
import VinylAlbum, { ShadowAlbum } from "../components/VinylAlbum";
import NotebookOverlay from "../components/NotebookOverlay";
import { hackAutoplay, usePlayback } from '../utils/PlayerContext';
import { isChrome, isEdge, isFirefox, isIOS, isMobile, isOpera, isSafari } from "react-device-detect";
import { Episode } from "@/types/episode";
import Link from "next/link";

const variants = {
  hidden: { opacity: 0 },
  enter: { opacity: 1 },
  exit: { opacity: 0 },
};

export default function EpisodeTable(props: {
  onReady: () => void,
  ready: boolean,
  cleared: boolean
}) {
  const router = useRouter();
  const [funqueue, _] = useState([] as (() => void)[]);

  const [snapping, setSnapping] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | undefined>(undefined);
  const [selectedPosition, setSelectedPosition] = useState(0);
  const [mayAnimate, setMayAnimate] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(true);
  const [hasClickedNotebook, setHasClickedNotebook] = useState(false);
  const [hasClickedPlay, setHasClickedPlay] = useState(false);
  const [overlayNotebookTranslation, setOverlayNotebookTranslation] = useState("left");
  const [displayedURL, setDisplayedURL] = useState("");
  const [episodeNumParam, setEpisodeNumParam] = useState(-1);
  const [vinyls, setVinyls] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState(vinyls.length - 1);
  const [selectedVinylRendered, setSelectedVinylRendered] = useState(false)
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false)
  const [browserName, setBrowserName] = useState("");

  const episodePage = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const shadows = useRef<HTMLDivElement>(null);
  const idleAnimationTimeoutIdRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hasClickedNotebookRef = useRef(hasClickedNotebook);
  const hasClickedPlayRef = useRef(hasClickedPlay);
  const selectedVinyl = useRef<HTMLImageElement>(null);
  const playbackMP3Ref = useRef<string | undefined>("");
  const isPlayingRef = useRef(false);

  const [isPresent, safeToRemove] = usePresence();
  const { setPlaying, setPlayingEpisode, isPlaying, playingEpisode, autoplay, status, audio } = usePlayback();

  const descriptionEpisode = isPlayingRef.current ? playingEpisode : vinyls[selectedEpisode];
  const { notebookOverlayComponent, referenceProps, refs } = NotebookOverlay({
    title: descriptionEpisode?.title?.split(/\s(-|–)\s?/g)[2]?.trim(),
    subtitle: `Avec ${descriptionEpisode?.title?.split(/\s(-|–)\s?/g)[0]?.trim()}`,
    desc: descriptionEpisode?.desc,
    translateX: overlayNotebookTranslation,
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

  isPlayingRef.current = isPlaying;
  playbackMP3Ref.current = playingEpisode?.mp3;

  const doIdlePlayButtonAnimation = useCallback(() => {
    if (hasClickedPlayRef.current || playbackMP3Ref.current) return;

    animate([
      [`.${styles.playButton}`, { opacity: 0.8 }, { ease: "easeOut", duration: 1 }],
      [`.${styles.playButton}`, { opacity: 0 }, { ease: "easeIn", duration: 0.5 }]
    ]).then(() => {
      if (!hasClickedPlayRef.current && !playbackMP3Ref.current) {
        clearTimeout(idleAnimationTimeoutIdRef.current);
        const id = setTimeout(doIdlePlayButtonAnimation, 6500);
        idleAnimationTimeoutIdRef.current = id;
      }
    });
  }, [playbackMP3Ref, hasClickedPlayRef]);

  const scrollCallback = useCallback(() => {
    setSnapping(false);
    if (funqueue.length && typeof window != "undefined") {
      (window.requestIdleCallback ? window.requestIdleCallback : window.requestAnimationFrame)((funqueue.shift() as () => void))
    }
    const currentPosition = getCurrentPosition();
    const currentEpisode = vinyls.length - currentPosition - 1;
    setSelectedPosition(currentPosition);
    setSelectedEpisode(currentEpisode);
    const newUrl = `${window.location.origin}/${currentEpisode + 1}`;
    setDisplayedURL(newUrl);
  }, [funqueue, getCurrentPosition, vinyls.length]);

  useEffect(() => {
    setIsMobileDevice(isMobile);
    if (isMobile) {
      setBrowserName(isChrome ? "Chrome" :
      isSafari ? "Safari" :
      isEdge ? "Edge" :
      isFirefox ? "Firefox" :
      isOpera ? "Opera" :
      "");
    }
  }, []);

  useEffect(() => {
    playbackMP3Ref.current = playingEpisode?.mp3;
    if (!playbackMP3Ref.current || !props.ready) return;

    const doNotebookIdleAnimation = () => {
      const notebookElement = document.getElementsByClassName(styles.notebook)[0];
      if (hasClickedNotebookRef.current || !notebookElement) return;

      const onFinished = () => {
        if (!hasClickedNotebookRef.current) {
          clearTimeout(idleAnimationTimeoutIdRef.current);
          const id = setTimeout(doNotebookIdleAnimation, 3750);
          idleAnimationTimeoutIdRef.current = id;
        }
      };

      if (!notebookElement?.matches(":hover")) {
        const notebookControls = animate([
          [`.${styles.notebook}`, { rotate: -6 }, { ease: "easeIn", duration: 0.2, at: "3" }],
          [`.${styles.notebook}`, { rotate: 6 }, { ease: "easeInOut", duration: 0.2 }],
          [`.${styles.notebook}`, { rotate: 0 }, { ease: "easeOut", duration: 0.4 }]
        ]).then(onFinished);
      } else onFinished();
    };

    clearTimeout(idleAnimationTimeoutIdRef.current);
    const id = setTimeout(doNotebookIdleAnimation, 100);
    idleAnimationTimeoutIdRef.current = id;

    return () => {
      clearTimeout(id);
      clearTimeout(idleAnimationTimeoutIdRef.current);
    }
  }, [playingEpisode?.mp3, props.ready]);

  useEffect(() => {
    if (displayedURL) {
      const id = setTimeout(() => {
        router.replace(displayedURL, undefined, { scroll: false, shallow: true });
      }, 600);

      return () => {
        clearTimeout(id);
      }
    }
  }, [router, displayedURL]);

  useEffect(() => {
    if (!props.ready) return;

    if (!hasClickedPlayRef.current && !isPlayingRef.current) { // if has never clicked Play Button and is not currently playing
      clearTimeout(idleAnimationTimeoutIdRef.current);
      const id = setTimeout(doIdlePlayButtonAnimation, 2500);
      idleAnimationTimeoutIdRef.current = id;
    };

    return () => {
      clearTimeout(idleAnimationTimeoutIdRef.current);
    }
  }, [vinyls.length, props.ready, doIdlePlayButtonAnimation]);

  useEffect(() => {
    if (router.query.episodeNum) {
      const selectedEp = Math.min(Number(router.query.episodeNum) - 1, vinyls.length - 1);
      setEpisodeNumParam(selectedEp);
      setSelectedEpisode(selectedEp);
    } else if (!episodeNumParam) {
      setEpisodeNumParam(vinyls.length - 1);
      setSelectedEpisode(vinyls.length - 1);
    }
  }, [router.query.episodeNum, vinyls.length, episodeNumParam]);

  useEffect(() => {
    const element = episodePage.current;
    if (element) {
      const { bind, unbind } = createScrollSnap(
        element as HTMLDivElement,
        {
          snapDestinationY: "100%",
          timeout: 0,
          duration: 0,
          easing: t => {
            setSnapping(true);
            return (--t) * t * t + 1;
          },
          threshold: 0.49,
        },
        scrollCallback
      );
      bind();
      mainRef.current?.focus();

      return unbind
    }
  }, [episodePage, getCurrentPosition, vinyls.length, funqueue, scrollCallback]);

  useEffect(() => {
    let clear = false;
    if (selectedVinyl.current && mainRef.current) {
      console.log("creating promises")
      const selectedVinylPromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          console.log("Timeout on selected vinyl tag");
          resolve();
        }, 7500);
        const img = selectedVinyl.current as HTMLImageElement;
        const oldOnload: (((e: Event) => any) | null) = img.onload;
        if (img.complete) {
          clearTimeout(timeoutId);
          resolve();
        } else img.onload = (ev: Event) => {
          clearTimeout(timeoutId);
          console.log("Loaded selected vinyl tag")
          resolve();
          if (oldOnload) oldOnload(ev);
        };
        img.onerror = () => {
          reject(new Error('Failed to load selectde vinyl img'));
        };
      });
      const floorPromise = new Promise<void>((resolve, reject) => {
        mainRef.current?.querySelectorAll(`.${styles.floor} img`).forEach((el) => {
          const timeoutId = setTimeout(resolve, 2500);
          const img = el as HTMLImageElement;
          if (img.complete) resolve();
          else img.onload = () => {
            console.log("Loaded floor img")
            resolve();
            clearTimeout(timeoutId);
          };
          img.onerror = () => {
            reject(new Error('Failed to load floor img'));
          };
        });
      });
      Promise.all([selectedVinylPromise, floorPromise]).then(() => {
        console.log("All images loaded")
        if (!clear) props.onReady();
      });
      return () => {
        clear = true;
      }
    } else {
      const timeoutId = setTimeout(() => {
        console.log("Timeout on selected vinyl tag");
        if (!clear) props.onReady();
      }, 7500);
      return () => {
        clearTimeout(timeoutId);
        clear = true;
      }
    }

  }, [selectedVinylRendered, selectedVinyl, props, mainRef]);

  useEffect(() => {
    if (vinyls.length == 0) {
      if (window.Worker) {
        const myWorker = new Worker("/js/vinylsFetcher.js");
        myWorker.onmessage = function(e) {
            const { data } = e;
            setVinyls(data);
        };
        myWorker.postMessage("");
        return () => {
          myWorker.terminate();
        }
      }
    }
  }, [vinyls?.length]);

  useEffect(() => {
    hasClickedNotebookRef.current = hasClickedNotebook;
    hasClickedPlayRef.current = hasClickedPlay;
    idleAnimationTimeoutIdRef.current = idleAnimationTimeoutIdRef.current;
  }, [hasClickedNotebook, hasClickedPlay, hasClickedNotebookRef]);

  const initialSectionScroll = useCallback((node: HTMLDivElement | null) => {
    if (node && node.offsetTop) {
      episodePage.current?.scrollTo({
        top: node.offsetTop,
        behavior: "instant",
      });
      setSelectedEpisode(episodeNumParam);
      setSelectedPosition(vinyls.length - episodeNumParam);
    }
  }, [vinyls.length, episodeNumParam]);

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
      const destination = selectedPosition * (episodePage.current?.clientHeight || 0);
      // console.log("scroll:", selectedPosition, ((episodePage.current)?.clientHeight || 0), destination);
      episodePage.current?.scroll({ top: destination, behavior: "instant" });
    }, 300);
    setTimeoutId(newId);
  });

  const handleKeyPress = (e: React.KeyboardEvent<HTMLDivElement>) => {
    let scroll;
    switch (e.keyCode) {
      case 38: // up arrow
        if (selectedPosition == 0) return;
        scroll = () => {
          const el = episodePage.current?.children[selectedPosition];
          episodePage.current?.scrollTo({
            top: (el as HTMLElement)?.offsetTop,
            behavior: "instant"
          });
          (window.requestIdleCallback ? window.requestIdleCallback : window.requestAnimationFrame)(scrollCallback);
        };
        if (snapping) {
          console.log("STUCK!");
          if (funqueue.length == 0) funqueue.push(scroll);
        }
        else scroll();
        break;
      case 40: // down arrow
        if (selectedPosition == vinyls.length - 1) return;
        scroll = () => {
          const el = episodePage.current?.children[selectedPosition + 1 + 1];
          episodePage.current?.scrollTo({
            top: (el as HTMLElement)?.offsetTop,
            behavior: "instant"
          });
          (window.requestIdleCallback ? window.requestIdleCallback : window.requestAnimationFrame)(scrollCallback);
        };
        if (snapping) {
          console.log("STUCK!");
          if (funqueue.length == 0) funqueue.push(scroll);
        }
        else scroll();
        break;
      case 32: // space key
        setPlaying(playing => !playing);
        break;
      case 13: // enter key
        playEpisode(selectedEpisode);
        setHasClickedPlay(true);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const playEpisode = (position: number, autoplay: boolean = false) => {
    if (!audio) {
      console.error("audio element not found!");
      return;
    }

    if (playingEpisode?.mp3 == vinyls[position].mp3) {
      console.log("same mp3");
      if (!autoplay) setPlaying(true);
      return;
    }

    const play = () => {
      setPlayingEpisode(vinyls[selectedEpisode])
    };

    if (audio.src || !isIOS) {
      setPlaying(false);
      play();
    } else {
      hackAutoplay(audio).then(play);
    }
  };

  const Chair: FC<any> = Chair_;
  const Notebook: FC<any> = Notebook_;
  const Pen: FC<any> = Pen_;
  const Headphones: FC<any> = Headphones_;
  const ImagedPostIt: FC<any> = ImagedPostIt_;

  return (
    <motion.div
      key="transition_loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: props.ready && !props.cleared && isPresent && router.pathname == "/[episodeNum]" ? 1 : 0 }}
      transition={{ type: 'linear', duration: 0.25 }}
      onUpdate={(latest: { opacity: number }) => {
        if (latest.opacity === 0 && !isPresent && !!safeToRemove) safeToRemove();
      }}
      className="transition_loader" >
      <div ref={episodePage} style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        overflow: "auto",
      }}>
        {cloneElement(notebookOverlayComponent, {})}
        <Head>
          <title>{playingEpisode?.title ? `${isPlaying ? "▶ " : ""}${playingEpisode?.title}` : `Septante Minutes Avec ${vinyls[selectedEpisode]?.title}`}</title>
          { isMobile && <link rel="stylesheet" href="https://unpkg.com/react-spring-bottom-sheet/dist/style.css" crossOrigin="anonymous" /> }
        </Head>
        <motion.div
          className={styles.main}
          ref={mainRef}
          onKeyDown={handleKeyPress}
          tabIndex={0}
        >
          <div className={styles.floor}>
            <Image alt="" priority={true} src="https://framerusercontent.com/images/2cF7KwwG8pFQ1uqfCehmKfeN0.jpg" sizes="100vw" style={{ objectFit: "cover" }} fill />
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
            {!isMobileDevice && <Headphones className={styles.headphones} />}
            <Pen className={styles.pen} />
            <Notebook
              className={styles.notebook}
              ref={refs.setReference}
              {...referenceProps}
              onClick={(e: Event) => {
                if (typeof referenceProps?.onClick === 'function') {
                  referenceProps.onClick(e);
                  setOverlayNotebookTranslation("left");
                }
                setHasClickedNotebook(true)
              }}
            />
            {!isMobileDevice && <Image alt="" fill src="https://framerusercontent.com/images/65xbC1wSqp8s7XWdQveqlGbrDM.png" sizes="23.47vmax" className={styles.phone} />}
            {!isMobileDevice && <Image alt="" fill src="https://framerusercontent.com/images/BCLSnD6iOuaJTuIlIDw59Og8xM.png" sizes="16vmax" className={styles.camera} />}
            <RecordPlayer className={styles.player} playing={isPlaying && status >= 3} onClick={() => {
              if (playingEpisode?.mp3) {
                setPlaying(!isPlaying);
              }
            }} />
            <div className={styles.postitnotes}>
              <ImagedPostIt
                className={[styles.postit, styles.home_postit].join(" ")}
                title={"Accueil"}
                link={`/#${selectedEpisode + 1}`}
              />
              <ImagedPostIt
                className={[styles.postit, styles.subscribe_postit].join(" ")}
                ref={refs.setReference}
                {...referenceProps}
                onClick={(e: Event) => {
                  if (typeof referenceProps?.onClick === 'function') {
                    referenceProps.onClick(e);
                    setOverlayNotebookTranslation("right");
                  }
                }}
                title={"S 'abonner"}
                separate={false}
              />
              <ImagedPostIt
                className={[styles.postit, styles.download_postit].join(" ")}
                title={"Télécharger"}
                link={vinyls[selectedEpisode]?.mp3}
                separate={true}
              />
              <ImagedPostIt
                className={[styles.postit, styles.contact_postit].join(" ")}
                title={"Contact"}
                link="mailto:contact@septanteminutes.be"
                separate={true}
              />
            </div>
            <motion.div className={styles.albums} onClick={() => {
              setHasClickedPlay(true);
              if (!audio) return;
              if (isMobile) {
                setBottomSheetOpen(true);
                return
              }
              playEpisode(selectedEpisode);
            }}>
              {vinyls.map((episode, index) => {
                return (<VinylAlbum
                  key={`vinyl_${episode.num}`}
                  ref={index === selectedEpisode ? selectedVinyl : undefined}
                  image={episode["img"] || ""}
                  alt={episode["title"]}
                  total={vinyls.length}
                  position={index}
                  onLoad={() => {
                    if (index === selectedEpisode) setSelectedVinylRendered(true);
                    if (!(isIOS && !audio?.src) && autoplay?.num == episode.num) {
                      console.log("autoplaying!");
                      playEpisode(index, true);
                    }
                  }}
                  onSelect={scrollCallback}
                  episodeNumParam={episodeNumParam}
                  scrollYProgress={scrollYProgress}
                  mayAnimate={mayAnimate}
                />
                )
              })
              }
              <div className={styles.playButton} style={{ opacity: 0 }}>
                { /* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/img/play.svg" alt="Lancer la lecture" role="button" />
              </div>
            </motion.div>
          </div>
          {vinyls[selectedEpisode] && <BottomSheet className={styles.bottomSheet} open={bottomSheetOpen} onDismiss={() => setBottomSheetOpen(false)} header={
            <h3>Écouter l'épisode sur…</h3>
          }>
            <div className={styles.bottomSheet}>
              {[{ name: "Spotify", color: "#1DB954", link: vinyls[selectedEpisode].spotifyLink },
              { name: "Apple Podcasts", color: "#872EC4", link: vinyls[selectedEpisode].appleLink, skip: !isIOS },
              { name: browserName || "Ce navigateur", color: "rgb(42, 50, 54)", link: "." }
              ].filter(i => !i.skip).map((service, i, array) => (
                <div className={styles.bottomSheetRow} key={`bottomSheetRow_${service.name}`}>
                  <img src={`/img/${i < array.length - 1 ? service.name.toLowerCase().replace(" ", "") : (browserName.toLowerCase() || "play")}.svg`} alt="Spotify Logo" />
                  <strong>{service.name}</strong>
                  <Link href={service.link}>
                    <button tabIndex={i*10} className={styles.roundButton} style={{ backgroundColor: service.color, }} onClick={() => {
                      setBottomSheetOpen(false);
                    }}>{i < array.length - 1 ? "Ouvrir ↗" : "Continuer"}</button>
                  </Link>
                </div>
              ))}
            </div>
          </BottomSheet>}
        </motion.div>
        {[...vinyls].reverse().map((v, i) => (
          <motion.div
            className={styles.section}
            key={`section_ep_${v.num}_${episodeNumParam > 0 ? "dep" : ""}`}
            ref={i === vinyls.length - (episodeNumParam + 1) ? initialSectionScroll : null}
            onViewportEnter={() => {
              if ((i === vinyls.length - (episodeNumParam + 1) && i != 0) || episodeNumParam == vinyls.length - 1) {
                setTimeout(() => {
                  setMayAnimate(true);
                }, 200);
              }
            }}
          >
            {(!process.env.NODE_ENV || process.env.NODE_ENV === 'development') && (
              <p>{`${i}__________episode#${v.num}: ${v.title}`}</p>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

type key = "1" | "2"; // Etc.

export const getStaticPaths = (async () => {
  const paths = Array.from(Array(199).keys()).map((i) => ({
    params: { episodeNum: `${i + 1}` },
  }));
  return {
    paths: paths,
    fallback: false // anything not included will 404
  }
}) satisfies GetStaticPaths

export const getStaticProps = (async (context) => {
  return { props: {} }
}) satisfies GetStaticProps<{
}>;
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
import { useRouter } from "next/router";
import Link from "next/link";
import dynamic from "next/dynamic";
import Head from "next/head";
import Image from "next/image";
import type {
  GetStaticProps,
  GetStaticPaths,
} from 'next';

import { Pen as Pen_ } from "../framer/ImageWrapper";
import Notebook_ from "../framer/Notebook-Large-POCp.js";
import ImagedPostIt_ from "../framer/Imaged-Post-It-1vlf.js";

import RecordPlayer from "../components/RecordPlayer";
import VinylAlbum, { ShadowAlbum } from "../components/VinylAlbum";
import NotebookOverlay from "../components/NotebookOverlay";
import { hackAutoplay, usePlayback } from '../utils/PlayerContext';
import { isChrome, isEdge, isFirefox, isIOS, isMobile, isOpera, isSafari } from "react-device-detect";
import { Episode } from "@/types/episode";

export default function EpisodeTable(props: {
  onReady: () => void,
  previouslyLoaded: boolean,
  cleared: boolean
}) {
  const router = useRouter();
  const [funqueue, _] = useState([] as (() => void)[]);

  const [ready, setReady] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | undefined>(undefined);
  const [selectedPosition, setSelectedPosition] = useState(0);
  const [mayAnimate, setMayAnimate] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(true);
  const [isPortrait, setIsPortrait] = useState(false);
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
  const onReadyRef = useRef(props.onReady);
  const isPlayingRef = useRef(false);

  const [isPresent, safeToRemove] = usePresence();
  const { setPlaying, setPlayingEpisode, isPlaying, playingEpisode, autoplay, status, audio } = usePlayback();

  const descriptionEpisode = isPlayingRef.current ? playingEpisode : vinyls[selectedEpisode];
  const { notebookOverlayComponent, referenceProps, refs } = NotebookOverlay({
    title: descriptionEpisode?.title?.split(/\s(-|–)\s?/g)[2]?.trim(),
    subtitle: `Avec ${descriptionEpisode?.title?.split(/\s(-|–)\s?/g)[0]?.trim()}`,
    desc: descriptionEpisode?.desc,
    date: descriptionEpisode?.date,
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
    // const playClickCount = Number(localStorage.getItem("hasClickedPlay") || 0);
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
  
  const onReady = useCallback(() => {
    if (onReadyRef.current) {
      onReadyRef.current();
    }
  }, [onReadyRef]);
  
    useEffect(() => {
      onReadyRef.current = props.onReady;
    }, [props.onReady]);
  
  useEffect(() => {
    setIsMobileDevice(isMobile);
    if (isMobile) {
      setBrowserName(isChrome ? "Chrome" :
      isSafari ? "Safari" :
      isEdge ? "Edge" :
      isFirefox ? "Firefox" :
      isOpera ? "Opera" :
      "");
      setIsPortrait(window.innerHeight > window.innerWidth);
    }
  }, []);

  useEffect(() => {
    playbackMP3Ref.current = playingEpisode?.mp3;
    if (!playbackMP3Ref.current || !ready) return;

    const doNotebookIdleAnimation = () => {
      const notebookElement = document.getElementsByClassName(styles.notebook)[0];
      const clickedNotebookCount = Number(localStorage.getItem("hasClickedNotebook") || 0);
      if (hasClickedNotebookRef.current || !notebookElement || clickedNotebookCount > 0) return;

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
    const id = setTimeout(doNotebookIdleAnimation, 1000);
    idleAnimationTimeoutIdRef.current = id;

    return () => {
      clearTimeout(id);
      clearTimeout(idleAnimationTimeoutIdRef.current);
    }
  }, [playingEpisode?.mp3, ready]);

  useEffect(() => {
    if (displayedURL && !displayedURL.includes(router.asPath) && router.pathname == "/[episodeNum]") {
      const id = setTimeout(() => {
        router.replace(displayedURL, undefined, { scroll: false, shallow: true });
      }, 200);

      return () => {
        clearTimeout(id);
      }
    }

    router.beforePopState(({ as }) => {
      if (as === "/") {
        const targetUrl = `/#${selectedEpisode + 1}`;
        requestAnimationFrame(() => {
          router.replace(targetUrl, undefined, { scroll: false, shallow: true });
        });
        return false;
      }
      return true;
    });
    
    return () => {
      router.beforePopState(() => true);
    }
  }, [router, displayedURL, selectedEpisode]);

  useEffect(() => {
    if (!ready || autoplay) return;

    if (!hasClickedPlayRef.current && !isPlayingRef.current) { // if has never clicked Play Button and is not currently playing
      clearTimeout(idleAnimationTimeoutIdRef.current);
      const id = setTimeout(doIdlePlayButtonAnimation, 2500);
      idleAnimationTimeoutIdRef.current = id;
    };

    return () => {
      clearTimeout(idleAnimationTimeoutIdRef.current);
    }
  }, [vinyls.length, ready, doIdlePlayButtonAnimation, autoplay]);

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
    if (ready) return;

    let clear = false;
    if (selectedVinyl.current && mainRef.current && mainRef.current.querySelectorAll('img[fetchpriority="high"]').length > 0) {
      console.log("creating promises")
      const priorityImages = [...document.querySelectorAll('img[fetchpriority="high"]')].map((el: Element, i: number) => (
        new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(resolve, 3000);
          const img = el as HTMLImageElement;
          const finish = () => {
            resolve();
            clearTimeout(timeoutId);
          }
          if (img.complete) finish();
          else img.onload = finish;
          img.onerror = () => {
            console.error(new Error('Failed to load priority img ' + i));
            finish();
          };
        })
      ));
      Promise.all(priorityImages).then(() => {
        console.log("All ", priorityImages.length, " images loaded")
        if (!clear) { 
          onReady();
          setReady(true);
        }
      });
      return () => {
        clear = true;
      }
    } else {
      const timeoutId = setTimeout(() => {
        console.log("Timeout on selected vinyl tag");
        if (!clear) onReady();
      }, 4500);
      return () => {
        clearTimeout(timeoutId);
        clear = true;
      }
    }

  }, [selectedVinylRendered, selectedVinyl, mainRef, ready, onReady]);

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
      setTimeout(() => {
        episodePage.current?.scrollTo({
          top: node.offsetTop,
          behavior: "instant",
        });
      }, 500);
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

  useEventListener("resize", (e) => {
    if (timeoutId) clearTimeout(timeoutId);
    const newId = setTimeout(() => {
      const destination = selectedPosition * (episodePage.current?.clientHeight || 0);
      // console.log("scroll:", selectedPosition, ((episodePage.current)?.clientHeight || 0), destination);
      episodePage.current?.scroll({ top: destination, behavior: "instant" });
    }, 300);
    setTimeoutId(newId);
    setIsPortrait(window.innerHeight > window.innerWidth);
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
        setPlaying(!isPlaying);
        break;
      case 13: // enter key
        playEpisode(selectedEpisode);
        setHasClickedPlay(true);
        const playClickCount = Number(localStorage.getItem("hasClickedPlay") || 0);
        if (playClickCount < 3) localStorage.setItem("hasClickedPlay", (playClickCount + 1).toString());
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const playEpisode = useCallback((position: number, autoplay: boolean = false) => {
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
  }, [audio, playingEpisode, vinyls, selectedEpisode, setPlayingEpisode, setPlaying]);

  const onVinylLoad = useCallback((episode: Episode, index: number) => {
    if (index === selectedEpisode) setSelectedVinylRendered(true);
    if (!(isIOS && !audio?.src) && autoplay?.num == episode.num) {
      console.log("autoplaying!");
      playEpisode(index, true);
    }
  }, [selectedEpisode, audio?.src, autoplay?.num, playEpisode]);

  const Notebook: FC<any> = Notebook_;
  const Pen: FC<any> = Pen_;
  const ImagedPostIt: FC<any> = ImagedPostIt_;

  const BottomSheet = dynamic(import("react-spring-bottom-sheet").then(mod => mod.BottomSheet), { ssr: false });
  const Headphones = dynamic(import("../framer/ImageWrapper.js").then(mod => mod.Headphones), { ssr: false });
  const Chair = dynamic(import("../framer/ImageWrapper.js").then(mod => mod.Chair), { ssr: false });

  return (
    <motion.div
      key="transition_loader"
      initial={{ opacity: 0.01 }}
      exit={{ opacity: 0 }}
      animate={{ opacity: ready ? 1 : 0.01 }}
      transition={{ type: 'linear', duration: 0.25 }}
      onAnimationComplete={(animDef: { opacity: number }) => {
        if (!isPresent && animDef.opacity === 0) {
          setReady(false);
          safeToRemove();
        }
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
          <title>{playingEpisode?.title ? `${isPlaying ? "▶ " : ""}${playingEpisode?.title}` : `Septante Minutes Avec ${descriptionEpisode?.title?.split(/\s(-|–)\s?/g)[0]?.trim()}`}</title>
          { isMobile && <link rel="stylesheet" href="https://unpkg.com/react-spring-bottom-sheet/dist/style.css" crossOrigin="anonymous" /> }
        </Head>
        <motion.div
          className={styles.main}
          ref={mainRef}
          onKeyDown={handleKeyPress}
          tabIndex={0}
        >
          <div className={styles.floor}>
            <Image draggable="false" alt="" priority={true} src="https://framerusercontent.com/images/2cF7KwwG8pFQ1uqfCehmKfeN0.jpg" sizes="100vw" style={{ objectFit: "cover" }} fill />
            { !(isMobileDevice && !isPortrait) && <Chair className={styles.chair} />}
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
            {!(isMobileDevice && isPortrait) && <Headphones className={styles.headphones} />}
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
                setHasClickedNotebook(true);
                const clickedNotebookCount = Number(localStorage.getItem("hasClickedNotebook") || 0);
                if (clickedNotebookCount == 0) localStorage.setItem("hasClickedNotebook", (clickedNotebookCount + 1).toString());
              }}
            />
            {!(isMobileDevice && isPortrait) && <Image draggable="false" alt="" fill src="https://framerusercontent.com/images/65xbC1wSqp8s7XWdQveqlGbrDM.png" sizes="23.47vmax" className={styles.phone} />}
            {!(isMobileDevice && isPortrait) && <Image draggable="false" alt="" fill src="https://framerusercontent.com/images/BCLSnD6iOuaJTuIlIDw59Og8xM.png" sizes="16vmax" className={styles.camera} />}
            <RecordPlayer className={styles.player} playing={isPlaying && status >= 3} onClick={() => {
              if (playingEpisode?.mp3) {
                setPlaying(!isPlaying);
              }
            }} />
            <div className={styles.postitnotes}>
              <ImagedPostIt
                className={[styles.postit, styles.home_postit].join(" ")}
                title={"Accueil"}
                src="/img/back.svg"
                link={`/#${selectedEpisode + 1}`}
              />
              <ImagedPostIt
                className={[styles.postit, styles.subscribe_postit].join(" ")}
                ref={refs.setReference}
                src="/img/subscribe.svg"
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
                src="/img/download.svg"
                link={vinyls[selectedEpisode]?.mp3}
                separate={true}
              />
              <ImagedPostIt
                className={[styles.postit, styles.contact_postit].join(" ")}
                title={"Contact"}
                src="/img/email4b.svg"
                link="mailto:contact@septanteminutes.be"
                separate={true}
              />
            </div>
            <motion.div className={styles.albums} onClick={() => {
              setHasClickedPlay(true);
              const playClickCount = Number(localStorage.getItem("hasClickedPlay") || 0);
              if (playClickCount < 3) localStorage.setItem("hasClickedPlay", (playClickCount + 1).toString());
              if (!audio) return;
              if (isMobile) {
                const preferredService = sessionStorage.getItem("preferredService");
                if (!preferredService) setBottomSheetOpen(true);
                else if (preferredService == "Spotify") {
                  window.open(vinyls[selectedEpisode].spotifyLink, "_blank");
                } else if (preferredService == "Apple Podcasts") {
                  window.open(vinyls[selectedEpisode].appleLink, "_blank");
                } else {
                  playEpisode(selectedEpisode);
                }
                return;
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
                  priority={ready}
                  onLoad={() => onVinylLoad(episode, index)}
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
                <img draggable="false" src="/img/play.svg" alt="Lancer la lecture" role="button" />
              </div>
            </motion.div>
          </div>
          {vinyls[selectedEpisode] && isMobileDevice && <BottomSheet className={styles.bottomSheet} open={bottomSheetOpen} onDismiss={() => setBottomSheetOpen(false)} header={
            <h3>{"Écouter l'épisode sur…"}</h3>
          }>
            <div className={styles.bottomSheet}>
              {[{ name: "Spotify", color: "#1DB954", link: vinyls[selectedEpisode].spotifyLink },
              { name: "Apple Podcasts", color: "#872EC4", link: vinyls[selectedEpisode].appleLink, skip: !isIOS },
              { name: browserName || "Ce navigateur", color: "rgb(42, 50, 54)", link: "#" }
              ].filter(i => !i.skip).map((service, i, array) => (
                <div className={styles.bottomSheetRow} key={`bottomSheetRow_${service.name}`}>
                  { /* eslint-disable-next-line @next/next/no-img-element */}
                  <img draggable="false" src={`/img/${i < array.length - 1 ? service.name.toLowerCase().replace(" ", "") : (browserName.toLowerCase() || "play")}.svg`} alt={`${service.name} Logo`} />
                  <strong>{service.name}</strong>
                  <Link target="_blank" href={service.link}>
                    <button tabIndex={i*10} className={styles.roundButton} style={{ backgroundColor: service.color, }} onClick={() => {
                      setBottomSheetOpen(false);
                      sessionStorage.setItem("preferredService", service.name);
                      if (service.link == "#") playEpisode(selectedEpisode);
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
};

type key = "1" | "2"; // Etc.

export const getStaticPaths = (async () => {
  const count = Number(process.env.EPISODES_COUNT);
  const paths = Array.from(Array(count).keys()).map((i) => ({
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
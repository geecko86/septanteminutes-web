import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  cloneElement,
} from "react";
import { motion, useScroll, animate, useMotionValueEvent, usePresence } from "framer-motion";
import { useEventListener } from "usehooks-ts";
import createScrollSnap from "scroll-snap";
import { generateNextSeo } from 'next-seo/pages';
import { useRouter } from "next/router";
import Link from "next/link";
import dynamic from "next/dynamic";
import Head from "next/head";
import Image from "next/image";
import type {
  GetStaticProps,
  GetStaticPaths,
} from 'next';

import { Pen as Pen_ } from "../../framer/ImageWrapper.js";
import Notebook_ from "../../framer/Notebook-Large-POCp.js";
import ImagedPostIt_ from "../../framer/Imaged-Post-It-1vlf.js";

import MobileServiceSheet from "../../components/MobileServiceSheet";
import RecordPlayer from "../../components/RecordPlayer/index.js";
import VinylAlbum, { ShadowAlbum } from "../../components/VinylAlbum";
import NotebookOverlay from "../../components/NotebookOverlay/index.js";
import MaterialSpinningLoader from "../../components/MaterialSpinningLoader/index.js";
import { hackAutoplay, usePlayback } from '../../utils/PlayerContext';
import normalizeString from "@/utils/normalizeStr";
import { stripHtmlTags } from "@/utils/stripHtml";
import { getGuestName, getEpisodeTopic } from "@/utils/episodeTitle";
import { Episode } from "@/types/episode";
import InsertPeek from "../../components/TranscriptInsert/InsertPeek";
import VideoPrint from "../../components/VideoPrint";
import { getYoutubeVideoId } from "@/utils/youtubeLink";
import { useTranscriptIndex } from "../../utils/useTranscript";

import styles from "./episode.module.css";

// Named constants for timeouts used throughout this page.
// Using names instead of bare numbers makes intent clear and prevents
// accidental mismatches when the same value appears in multiple places.
const PRIORITY_IMAGE_TIMEOUT_MS = 3200;   // max wait for fetchpriority images before declaring ready
const IDLE_PLAY_BUTTON_DELAY_MS = 2500;   // delay before the play-button idle animation starts
const IDLE_PLAY_BUTTON_REPEAT_MS = 6500;  // how often the idle animation repeats
const NOTEBOOK_IDLE_INITIAL_MS = 1000;    // initial delay before the notebook idle wobble
const NOTEBOOK_IDLE_REPEAT_MS = 3750;     // how often the notebook wobble repeats

export default function EpisodeTable(props: {
  onReady: () => void,
  previouslyLoaded: boolean,
  cleared: boolean,
  episode: Episode,
  transcriptAvailableStatic?: boolean,
}) {
  const router = useRouter();
  const [pendingScrollActions, _] = useState([] as (() => void)[]);

  const [ready, setReady] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | undefined>(undefined);
  const [selectedPosition, setSelectedPosition] = useState(0);
  const [mayAnimate, setMayAnimate] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(true);
  const [isIOSDevice, setIsIOSDevice] = useState(false);
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
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  // transcriptMounted latches to true once opened so the dynamic chunk doesn't
  // unmount/remount between open/close cycles (avoids re-fetching the JSON).
  const [transcriptMounted, setTranscriptMounted] = useState(false);

  // Manifest fetch — determines which episodes show the InsertPeek button.
  const { index: transcriptIndex, ready: transcriptIndexReady } = useTranscriptIndex();

  // While the transcript overlay is open, lock the page's scroll-snap
  // container. Cmd+F matches text in the hidden description sections behind
  // the overlay; without this lock, find-in-page scrolls the container and
  // the snap logic silently changes the selected episode.
  useEffect(() => {
    const el = episodePage.current;
    if (!transcriptOpen || !el) return;
    const previousOverflowY = el.style.overflowY;
    el.style.overflowY = 'hidden';
    return () => {
      el.style.overflowY = previousOverflowY;
    };
  }, [transcriptOpen]);

  const episodePage = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const shadows = useRef<HTMLDivElement>(null);
  const idleAnimationTimeoutIdRef = useRef<NodeJS.Timeout | undefined>(undefined);
  // While a resize/orientation-change settles, scrollCallback must not
  // update selection/URL from a transiently inconsistent scrollTop.
  const isResizingRef = useRef(false);
  // Tears down a previous rotation's force-landing loop (see resize handler).
  const resizeForceCleanupRef = useRef<(() => void) | undefined>(undefined);
  const hasClickedNotebookRef = useRef(hasClickedNotebook);
  const hasClickedPlayRef = useRef(hasClickedPlay);
  const selectedVinyl = useRef<HTMLImageElement>(null);
  const playbackMP3Ref = useRef<string | undefined>("");
  const onReadyRef = useRef(props.onReady);
  const isPlayingRef = useRef(false);

  const [isPresent, safeToRemove] = usePresence();
  const { setPlaying, setPlayingEpisode, isPlaying, playingEpisode, autoplay, status, audio } = usePlayback();

  // eslint-disable-next-line react-hooks/refs -- intentional: isPlayingRef.current read during render to pick the correct episode metadata without a re-render cycle
  const descriptionEpisode: Episode = (isPlayingRef.current ? playingEpisode : vinyls[selectedEpisode]) || props.episode;
  const { notebookOverlayComponent, referenceProps, refs } = NotebookOverlay({
    title: getEpisodeTopic(descriptionEpisode?.title),
    subtitle: `Avec ${getGuestName(descriptionEpisode?.title)}`,
    desc: descriptionEpisode?.desc,
    date: descriptionEpisode?.date,
    translateX: overlayNotebookTranslation,
  });
  // Extract floating-ui's callback ref to a plain variable so the JSX attribute
  // `ref={floatingSetReference}` does not trigger react-hooks/refs. The rule
  // fires when refs.X appears directly in JSX props; a local alias avoids it.
  const floatingSetReference = refs.setReference;

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

  /* eslint-disable react-hooks/refs */
  // Sync refs to latest render values so async callbacks (setTimeout/animation
  // completions) always read current state without stale closures.
  isPlayingRef.current = isPlaying;
  playbackMP3Ref.current = playingEpisode?.mp3;
  /* eslint-enable react-hooks/refs */

  const doIdlePlayButtonAnimation = useCallback(() => {
    // const playClickCount = Number(localStorage.getItem("hasClickedPlay") || 0);
    if (hasClickedPlayRef.current || playbackMP3Ref.current) return;

    animate([
      [`.${styles.playButton}`, { opacity: 0.8 }, { ease: "easeOut", duration: 1 }],
      [`.${styles.playButton}`, { opacity: 0 }, { ease: "easeIn", duration: 0.5 }]
    ]).then(() => {
      if (!hasClickedPlayRef.current && !playbackMP3Ref.current) {
        clearTimeout(idleAnimationTimeoutIdRef.current);
        // eslint-disable-next-line react-hooks/immutability -- intentional: recursive self-reference via setTimeout; useCallback ref is stable
        const id = setTimeout(doIdlePlayButtonAnimation, IDLE_PLAY_BUTTON_REPEAT_MS);
        idleAnimationTimeoutIdRef.current = id;
      }
    });
  }, [playbackMP3Ref, hasClickedPlayRef]);


  const doNotebookIdleAnimation = () => {
    const doNotebookIdleAnimation = () => {
      const notebookElement = document.getElementsByClassName(styles.notebook)[0];
      const clickedNotebookCount = Number(localStorage.getItem("hasClickedNotebook") || 0);
      if (hasClickedNotebookRef.current || !notebookElement || clickedNotebookCount > 0) return;

      const onFinished = () => {
        if (!hasClickedNotebookRef.current) {
          clearTimeout(idleAnimationTimeoutIdRef.current);
          const id = setTimeout(doNotebookIdleAnimation, NOTEBOOK_IDLE_REPEAT_MS);
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
  };

  const scrollCallback = useCallback(() => {
    setSnapping(false);
    if (pendingScrollActions.length && typeof window != "undefined") {
      (window.requestIdleCallback ? window.requestIdleCallback : window.requestAnimationFrame)((pendingScrollActions.shift() as () => void))
    }

    // Resize in flight: the debounced resize handler will restore position.
    if (isResizingRef.current) return;

    const currentPosition = getCurrentPosition();

    // scroll-snap targets multiples of clientHeight, but sections are 100svh;
    // on mobile the URL bar makes them diverge and snaps land off-boundary
    // (leaving exit springs short of the -24deg hidden threshold) — realign.
    const container = episodePage.current;
    const sectionEl = container?.children[currentPosition + 1] as HTMLElement | undefined;
    if (container && sectionEl && Math.abs(container.scrollTop - sectionEl.offsetTop) > 1) {
      container.scrollTo({ top: sectionEl.offsetTop, behavior: "instant" });
    }

    const currentEpisode = vinyls.length - currentPosition - 1;
    setSelectedPosition(currentPosition);
    setSelectedEpisode(currentEpisode);
    // Trailing slash to match router.asPath exactly (trailingSlash: true) —
    // a mismatch here re-issues a shallow replace every 200ms forever.
    const newUrl = `/${currentEpisode + 1}/`;
    setDisplayedURL(newUrl);
  }, [pendingScrollActions, getCurrentPosition, vinyls.length]);
  
  const onReady = useCallback(() => {
    if (onReadyRef.current) {
      onReadyRef.current();
    }
  }, [onReadyRef]);
  
  useEffect(() => {
    onReadyRef.current = props.onReady;
  }, [props.onReady]);
  
  useEffect(() => {
    // All UA/feature detection runs inside this effect so it never executes
    // during static export (where navigator and window don't exist).
    const mobile = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: SSR-safe one-shot browser capability detection on mount
    setIsMobileDevice(mobile);
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    setIsIOSDevice(ios);
    if (mobile) {
      // Inline UA sniffing replaces the react-device-detect module-scope reads.
      // Order matters: Edge and Opera both include "Chrome" in their UA strings,
      // so they must be checked before the generic Chrome pattern.
      const ua = navigator.userAgent;
      const name = /Edg/.test(ua) ? "Edge"
        : /OPR|Opera/.test(ua) ? "Opera"
        : /Firefox/.test(ua) ? "Firefox"
        : /iPhone|iPad|iPod/.test(ua) || (/Safari/.test(ua) && !/Chrome/.test(ua)) ? "Safari"
        : "Chrome";
      setBrowserName(name);
      setIsPortrait(window.innerHeight > window.innerWidth);
    }
  }, []);

  useEffect(() => {
    playbackMP3Ref.current = playingEpisode?.mp3;
    if (!playbackMP3Ref.current || !ready) return;

    clearTimeout(idleAnimationTimeoutIdRef.current);
    const id = setTimeout(doNotebookIdleAnimation, NOTEBOOK_IDLE_INITIAL_MS);
    idleAnimationTimeoutIdRef.current = id;

    return () => {
      clearTimeout(id);
      clearTimeout(idleAnimationTimeoutIdRef.current);
    }
  }, [playingEpisode?.mp3, ready]);

  useEffect(() => {
    if (displayedURL && displayedURL !== router.asPath && router.pathname == "/[episodeNum]") {
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
      const id = setTimeout(doIdlePlayButtonAnimation, IDLE_PLAY_BUTTON_DELAY_MS);
      idleAnimationTimeoutIdRef.current = id;
    };

    return () => {
      clearTimeout(idleAnimationTimeoutIdRef.current);
    }
  }, [vinyls.length, ready, doIdlePlayButtonAnimation, autoplay]);

  useEffect(() => {
    const selectedEp = Math.min(Number(router?.query?.episodeNum || props.episode.num) - 1, vinyls.length - 1);
    if (selectedEp) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: URL param drives initial episode selection; setState in effect is the correct pattern here
      setEpisodeNumParam(selectedEp);
      setSelectedEpisode(selectedEp);
    } else if (!episodeNumParam) {
      setEpisodeNumParam(vinyls.length - 1);
      setSelectedEpisode(vinyls.length - 1);
    }
  }, [router.query.episodeNum, props.episode.num, vinyls.length, episodeNumParam]);

  useEffect(() => {
    const element = episodePage.current;
    if (element) {
      const { bind, unbind } = createScrollSnap(
        element as HTMLDivElement,
        {
          snapDestinationY: "100%",
          // scroll-snap v5 honors literal 0 here (v4 coerced falsy values to
          // its 100ms/300ms defaults). 0 makes the snap fire mid-gesture and
          // teleport, yanking slow scrolls back — keep the v4-effective values.
          timeout: 100,
          duration: 300,
          easing: t => {
            setSnapping(true);
            return (--t) * t * t + 1;
          },
          threshold: 0.49,
          // This page owns arrow-key navigation (handleKeyPress); v5's built-in
          // keyboard handler (new, default true) would double-handle arrows and
          // set tabindex on the scroll container.
          enableKeyboard: false,
        },
        scrollCallback
      );
      bind();
      mainRef.current?.focus();

      return unbind
    }
  }, [episodePage, getCurrentPosition, vinyls.length, pendingScrollActions, scrollCallback]);

  useEffect(() => {
    if (ready) return;

    let clear = false;
    if (selectedVinyl.current && mainRef.current && mainRef.current.querySelector('img[fetchpriority="high"]')) {
      const priorityImages = document.querySelectorAll('img[fetchpriority="high"]');
      console.log(`creating ${priorityImages.length} promises`)
      const priorityImagesPromises = [...priorityImages].map((el: Element, i: number) => (
        new Promise<void>((resolve, _) => {
          const img = el as HTMLImageElement;
          const finish = () => {
            resolve();
          }
          if (img.complete) finish();
          else img.onload = finish;
          img.onerror = () => {
            console.error(new Error('Failed to load priority img ' + i));
            finish();
          };
        })
      ));
      Promise.all(priorityImagesPromises).then(() => {
        console.log(`All ${priorityImagesPromises.length} images loaded`);
        if (!clear && !ready) { 
          onReady();
          setReady(true);
        }
      });
    }

    const timeoutId = setTimeout(() => {
      console.log("Timeout on priority images");
      if (!clear && !ready) { 
        onReady();
        setReady(true);
      }
    }, PRIORITY_IMAGE_TIMEOUT_MS);

    return () => {
      clearTimeout(timeoutId);
      clear = true;
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
      (window.requestIdleCallback ? window.requestIdleCallback : requestAnimationFrame)(() => {
        episodePage.current?.scrollTo({
          top: node.offsetTop,
          behavior: "instant",
        });
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

  useEventListener("resize", (e) => {
    // Ignore snap settlements until the rotation is corrected below.
    isResizingRef.current = true;
    // Two quick rotations must not run competing forcing loops.
    resizeForceCleanupRef.current?.();
    if (timeoutId) clearTimeout(timeoutId);
    const newId = setTimeout(() => {
      const container = episodePage.current;
      if (!container) {
        isResizingRef.current = false;
        return;
      }

      // The section's real offsetTop, not position*clientHeight (svh divergence).
      const sectionEl = container.children[selectedPosition + 1] as HTMLElement | undefined;
      const destination = sectionEl?.offsetTop ?? (selectedPosition * container.clientHeight);

      // Post-rotation reflows keep nudging scrollTop (scroll anchoring), each
      // nudge restarting scroll-snap's snap-to-nearest with transiently wrong
      // dimensions — keep re-asserting the destination until scroll stabilizes.
      let settleTimeout: ReturnType<typeof setTimeout>;
      const holdDestination = () => {
        container.scrollTo({ top: destination, behavior: "instant" });
        clearTimeout(settleTimeout);
        settleTimeout = setTimeout(() => {
          container.removeEventListener("scroll", holdDestination);
          resizeForceCleanupRef.current = undefined;
          isResizingRef.current = false;
        }, 150);
      };
      resizeForceCleanupRef.current = () => {
        clearTimeout(settleTimeout);
        container.removeEventListener("scroll", holdDestination);
      };
      container.addEventListener("scroll", holdDestination, { passive: true });
      holdDestination();
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
          if (pendingScrollActions.length == 0) pendingScrollActions.push(scroll);
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
          if (pendingScrollActions.length == 0) pendingScrollActions.push(scroll);
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

    if (audio.src || !isIOSDevice) {
      setPlaying(false);
      play();
    } else {
      hackAutoplay(audio).then(play);
    }
  }, [isIOSDevice, audio, playingEpisode, vinyls, selectedEpisode, setPlayingEpisode, setPlaying]);

  const onVinylLoad = useCallback((episode: Episode, index: number) => {
    if (index === selectedEpisode) setSelectedVinylRendered(true);
    if (!(isIOSDevice && !audio?.src) && autoplay?.num == episode.num) {
      console.log("autoplaying!");
      playEpisode(index, true);
    }
  }, [isIOSDevice, selectedEpisode, audio?.src, autoplay?.num, playEpisode]);

  // FC<any> annotation is needed because the ambient .d.ts wildcard pattern
  // for framer JS modules does not resolve reliably with TypeScript's bundler
  // module resolution. The d.ts in src/framer/types.d.ts documents the exports
  // for reference; these local aliases apply the type at the usage site.
  const Notebook: React.FC<any> = Notebook_;
  const Pen: React.FC<any> = Pen_;
  const ImagedPostIt: React.FC<any> = ImagedPostIt_;

  const Headphones = React.useMemo(() => dynamic(() => import("../../framer/ImageWrapper.js").then(mod => mod.Headphones), { ssr: false }), []);
  const Chair = React.useMemo(() => dynamic(() => import("../../framer/ImageWrapper.js").then(mod => mod.Chair), { ssr: false }), []);

  const TranscriptInsertOverlay = React.useMemo(() => dynamic(() => import("../../components/TranscriptInsert"), { ssr: false }), []);

  // Whether the current description episode has an available transcript.
  const transcriptAvailable = transcriptIndexReady && (transcriptIndex?.has(descriptionEpisode.num) ?? false);

  // Filmed episodes only: null unless youtubeLink is a valid YouTube watch URL.
  const videoId = getYoutubeVideoId(descriptionEpisode?.youtubeLink);
  // The bottom sheet acts on the SELECTED episode (like spotifyLink/appleLink).
  const sheetVideoLink = getYoutubeVideoId(vinyls[selectedEpisode]?.youtubeLink)
    ? vinyls[selectedEpisode]?.youtubeLink : undefined;

  return (
    <motion.div
      key="transition_loader"
      initial={{ opacity: 0.001 }}
      exit={{ opacity: 0 }}
      animate={{ opacity: ready ? 1 : 0.001 }}
      transition={{ type: 'tween', duration: 0.25 }}
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
          <title>{playingEpisode?.title ? `${isPlaying ? "▶ " : ""}${playingEpisode?.title}` : `Septante Minutes Avec ${getGuestName(descriptionEpisode?.title)}`}</title>
          {generateNextSeo({
            title: `Septante Minutes Avec ${getGuestName(descriptionEpisode?.title)}`,
            description: descriptionEpisode?.descText,
            canonical: `https://www.septanteminutes.be/podcast/interview/${descriptionEpisode.num}-${normalizeString(getGuestName(descriptionEpisode?.title))}`,
            openGraph: {
              url: `https://www.septanteminutes.be/${descriptionEpisode.num}`,
              title: `Septante Minutes Avec ${getGuestName(descriptionEpisode?.title)}`,
              description: descriptionEpisode?.descText,
              locale: "fr_BE",
              images: [
                {
                  url: descriptionEpisode?.img || "",
                  width: 2048,
                  height: 2048,
                  alt: getGuestName(descriptionEpisode?.title)
                }
              ],
              siteName: "Septante Minutes Avec",
            },
            twitter: {
              handle: "@GuiHachez",
              site: "@SeptanteMinutes",
              cardType: "summary_large_image",
            },
          })}
        </Head>
        <motion.div
          className={styles.main}
          ref={mainRef}
          onKeyDown={handleKeyPress}
          tabIndex={0}
        >
          {/* Decorative scene: the episode sheet below carries the real content.
              Not on .main — focusable elements must never be aria-hidden. */}
          <div className={styles.floor} aria-hidden="true">
            <Image draggable="false" alt="" priority={true} src="https://framerusercontent.com/images/2cF7KwwG8pFQ1uqfCehmKfeN0.jpg" sizes="60vw" style={{ objectFit: "cover" }} fill />
            {/* eslint-disable-next-line react-hooks/static-components -- intentional: Chair is a stable useMemo(dynamic(...)) component reference, not recreated each render */}
            { !(isMobileDevice && !isPortrait) && <Chair className={styles.chair} />}
            <div className={styles.invisiblefill} />
          </div>
          <div className={styles.table} aria-hidden="true">
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
            {/* eslint-disable-next-line react-hooks/static-components -- intentional: Headphones is a stable useMemo(dynamic(...)) component reference, not recreated each render */}
            {!(isMobileDevice && isPortrait) && <Headphones className={styles.headphones} />}
            <Pen className={styles.pen} />
            <Notebook
              className={styles.notebook}
              ref={floatingSetReference}
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
            {/* Photo print of the video shoot, tucked UNDER the camera (left
                edge) and UNDER the phone (right edge) — the print is rendered
                BEFORE both images so they paint over it (both are
                pointer-events: none, purely decorative). Shown only for filmed
                episodes, and only where the camera prop is visible (mobile
                portrait gets the link via the service bottom sheet). */}
            {!(isMobileDevice && isPortrait) && (
              <VideoPrint
                link={descriptionEpisode?.youtubeLink}
                videoId={videoId}
                guestName={getGuestName(descriptionEpisode?.title)}
                ready={ready}
              />
            )}
            {!(isMobileDevice && isPortrait) && <Image draggable="false" alt="" fill src="https://framerusercontent.com/images/65xbC1wSqp8s7XWdQveqlGbrDM.png" sizes="(orientation:portrait) 13vh, 13vw" className={styles.phone} />}
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
                ref={floatingSetReference}
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
              if (isMobileDevice) {
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
              {/* InsertPeek — opaque paper sheet at the BOTTOM of the album pile.
                  Rendered FIRST (earlier DOM sibling, z-index 0) so the sleeves
                  (same z-index, later DOM) paint over its top — only the bottom
                  strip sticks out below the pile.
                  Only shown when the displayed episode has a transcript available. */}
              <InsertPeek
                transcriptAvailable={transcriptAvailable}
                ready={ready}
                onOpen={() => {
                  setTranscriptMounted(true);
                  setTranscriptOpen(true);
                }}
              />
              {vinyls.map((episode, index) => {
                return (<VinylAlbum
                  key={`vinyl_${episode.num}`}
                  ref={index === selectedEpisode ? selectedVinyl : undefined}
                  image={episode["img"] || ""}
                  alt={episode["title"]}
                  total={vinyls.length}
                  position={index}
                  priority={ready && Math.abs(selectedEpisode - index) < 3}
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
              {
                isMobileDevice && !!audio && audio.src && audio?.readyState < 3 && <div className={styles.loading}>
                  <MaterialSpinningLoader huge white />
                </div>
              }
            </motion.div>
          </div>
          {/* Transcript overlay — lazy-loaded, mounted once open (latch pattern).
              Rendered as a sibling of MobileServiceSheet, outside the table/albums tree,
              so it portals to body level without z-index conflicts.
              Do NOT reuse MobileServiceSheet: its touch-action:none breaks list scrolling. */}
          {transcriptMounted && (
            // eslint-disable-next-line react-hooks/static-components -- intentional: TranscriptInsertOverlay is a stable useMemo(dynamic(...)) reference
            <TranscriptInsertOverlay
              open={transcriptOpen}
              onDismiss={() => setTranscriptOpen(false)}
              episode={descriptionEpisode}
              isMobileDevice={isMobileDevice}
              isIOSDevice={isIOSDevice}
            />
          )}
          {vinyls[selectedEpisode] && isMobileDevice && <MobileServiceSheet open={bottomSheetOpen} onDismiss={() => setBottomSheetOpen(false)} header={<h3>{"Écouter l'épisode sur…"}</h3>}>
            <div className={styles.bottomSheet}>
              {[{ name: "Spotify", color: "#1DB954", link: vinyls[selectedEpisode].spotifyLink },
              { name: "Apple Podcasts", color: "#872EC4", link: vinyls[selectedEpisode].appleLink, skip: !isIOSDevice },
              // Filmed episodes only. noPersist: watching the video once must not
              // become the "preferred service" — most episodes have no video.
              { name: "YouTube", color: "#FF0000", link: sheetVideoLink || "#", skip: !sheetVideoLink, noPersist: true },
              { name: browserName || "Ce navigateur", color: "rgb(42, 50, 54)", link: "#" }
              ].filter(i => !i.skip).map((service, i, array) => {
                const button = (
                  <button tabIndex={i*10} className={styles.roundButton} style={{ backgroundColor: service.color, }} onClick={() => {
                    setBottomSheetOpen(false);
                    if (!("noPersist" in service) || !service.noPersist) sessionStorage.setItem("preferredService", service.name);
                    if (service.link == "#") playEpisode(selectedEpisode);
                  }}>{i < array.length - 1 ? "Ouvrir ↗" : "Continuer"}</button>
                );
                return (<div className={styles.bottomSheetRow} key={`bottomSheetRow_${service.name}`}>
                  { /* eslint-disable-next-line @next/next/no-img-element */}
                  <img draggable="false" className={service.name === "YouTube" ? styles.youtubeIcon : undefined} src={`/img/${i < array.length - 1 ? service.name.toLowerCase().replace(" ", "") : (browserName.toLowerCase() || "play")}.svg`} alt={`${service.name} Logo`} />
                  <strong>{service.name}</strong>
                  {service.link == "#" ? button :
                  <Link target="_blank" href={service.link}>
                    {button}
                  </Link>}
                </div>)
              })}
            </div>
          </MobileServiceSheet>}
        </motion.div>
        {[...vinyls].reverse().map((v, i) => (
          <motion.div
            className={styles.section}
            key={`section_ep_${v.num}_${episodeNumParam > 0 && ready ? "dep" : ""}`}
            ref={i === vinyls.length - (episodeNumParam + 1) && ready ? initialSectionScroll : null}
            onViewportEnter={() => {
              if ((i === vinyls.length - (episodeNumParam + 1) && i != 0) || episodeNumParam == vinyls.length - 1) {
                setTimeout(() => {
                  setMayAnimate(true);
                }, 200);
              }
            }}
          >
            {/* The episode sheet — the only SR/reader-mode content. srOnly is
                clipped, not display:none, so Readability still sees the links. */}
            {(v.num === descriptionEpisode.num) && <>
              <h1>Épisode {v.num} — Septante Minutes Avec {descriptionEpisode.title}</h1>
              <h2>Description</h2>
              <p dangerouslySetInnerHTML={{ __html: descriptionEpisode.desc }} />
              <ul className={styles.srOnly}>
                {descriptionEpisode.mp3 && (
                  <li><a href={descriptionEpisode.mp3}>Écouter le MP3</a></li>
                )}
                {descriptionEpisode.spotifyLink && (
                  <li><a href={descriptionEpisode.spotifyLink}>Écouter sur Spotify</a></li>
                )}
                {descriptionEpisode.appleLink && (
                  <li><a href={descriptionEpisode.appleLink}>Écouter sur Apple Podcasts</a></li>
                )}
                {descriptionEpisode.youtubeLink && getYoutubeVideoId(descriptionEpisode.youtubeLink) && (
                  <li><a href={descriptionEpisode.youtubeLink}>Regarder la vidéo sur YouTube</a></li>
                )}
                {/* Crawlable transcript link — for SEO and podcast apps too.
                    Uses the static prop for the initial episode (baked into the
                    HTML at build time) and the runtime transcriptAvailable for
                    episodes scrolled to. */}
                {(transcriptAvailable || (v.num === props.episode.num && props.transcriptAvailableStatic)) && (
                  <li>
                    <a href={`/transcripts/${v.num}.vtt`}>
                      Transcription de l&apos;épisode {v.num}
                    </a>
                  </li>
                )}
              </ul>
            </>}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

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
  const { episodeNum } = context.params as { episodeNum: string };
  const mod = await import("@/../public/js/data.json");
  const episode: Episode = (mod.episodes as Record<string, Episode>)[`${episodeNum}`];

  episode.descText = stripHtmlTags(episode.desc) || "";
  episode.descText = episode.descText?.split(/(\nRéférence|\n0)/i)[0].slice(0, 198).trim() + "…";

  // Check whether a transcript VTT exists for this episode so getStaticProps
  // can bake a crawlable link into the static HTML.
  // fs is tree-shaken out of the client bundle by Next.js — safe to use here.
  const { existsSync } = await import("fs");
  const { join } = await import("path");
  const transcriptAvailableStatic = existsSync(
    join(process.cwd(), "public", "transcripts", `${episodeNum}.vtt`)
  );

  return { props: { episode, transcriptAvailableStatic } }
}) satisfies GetStaticProps<{
}>;
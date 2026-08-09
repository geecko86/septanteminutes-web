import React, {
    useState,
    useRef,
    useEffect,
    useLayoutEffect,
    useCallback,
} from "react";
import { motion, useTransform, useMotionValue, useScroll, animate, AnimationPlaybackControls, MotionValue, usePresence } from "framer-motion";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from 'next/router';

import Season_, { Chairs } from "../components/Season";
import { usePlayback } from '../utils/PlayerContext';

import HomeAlbum_ from "../components/HomeAlbum";
import BellLamp_ from "../framer/assets/BellLamp";
import PlantA2_ from "../framer/assets/Plant2";
import BackwallLight from "../framer/assets/BackwallLight";
import { waitForInitialScene } from "../utils/initialSceneReady";

const loadPlantA = () => import("../framer/assets/Plant0");
const loadEggchair = () => import("../framer/assets/Eggchair");
const loadPlantB = () => import("../framer/assets/Plant1");
const loadPlantD = () => import("../framer/assets/Plant3");
const loadPlantE = () => import("../framer/assets/Plant4");
const loadFrontColumn = () => import("../components/FrontColumn");

const PlantA = dynamic(loadPlantA, { ssr: false });
const Eggchair = dynamic(loadEggchair, { ssr: false });
const PlantB = dynamic(loadPlantB, { ssr: false });
const PlantD = dynamic(loadPlantD, { ssr: false });
const PlantE = dynamic(loadPlantE, { ssr: false });

import ScrollToAnchor from "../utils/scroll_to_anchor"
import Head from "next/head";

import type { Episode, Season } from "../types/episode";
import Poster, { posters } from "@/components/Poster";

import styles from "./index.module.css";
import { generateNextSeo } from "next-seo/pages";
import { GetStaticProps } from "next";
import { BUILD_ID } from "../utils/buildId";

const SwipeAnim = dynamic(() => import("../components/SwipeAnim"), { ssr: false });
const FrontColumn = dynamic(loadFrontColumn, { ssr: false });

// Parallax speed multipliers for each scene layer.
// Each layer scrolls at a different rate relative to the camera scroll (newScrollX),
// creating the illusion of depth. Higher = faster = closer to the viewer.
const FLOOR_PARALLAX_FACTOR = 0.3012;
const LAYER_1_5_PARALLAX_FACTOR = 1.15;
const LAYER_2_PARALLAX_FACTOR = 2.3;

// Lamp-count calculation uses the lamp's width as a fraction of the viewport height.
const LAMP_FACTOR_LAYER_1_5 = 0.27;
const LAMP_FACTOR_LAYER_2 = 0.45;

// How long to wait before fetching all seasons (deferred to avoid blocking LCP).
const SEASON_FETCH_DELAY_MS = 12000;

// Idle swipe animation: starts after INITIAL_DELAY and repeats every REPEAT ms.
const IDLE_SWIPE_INITIAL_DELAY_MS = 1750;
const IDLE_SWIPE_REPEAT_MS = 3500;

const structuredObject = JSON.stringify({
    "@context" : "https://schema.org",
    "@type" : "WebSite",
    name : "Septante Minutes Avec",
    url : "https://www.septanteminutes.be/",
    Image : "https://res.cloudinary.com/dcodwkhcg/image/upload/v1722887962/avatar.jpg",
});

export default function Home(props: {
    seasons: Season[],
    onReady: () => void,
    style: React.CSSProperties
}) {
    const onPageReady = props.onReady;
    // FC<any> annotation needed — the ambient .d.ts wildcard does not match
    // relative imports under TypeScript bundler resolution. See src/framer/types.d.ts.
    const Season: React.FC<any> = Season_;
    const HomeAlbum: React.FC<any> = HomeAlbum_;
    const BellLamp: React.FC<any> = BellLamp_;
    const PlantA2: React.FC<any> = PlantA2_;

    const [ready, setReady] = useState(false);
    const [seasons, setSeasons] = useState<Season[]>(props.seasons || []);
    const [frontPosters, setFrontPosters] = useState<any[]>([]);
    const [screenContentRatio, setRatio] = useState(1);
    const [columnFocus, setColumnFocus] = useState(false);
    const [showSwiper, setShowSwiper] = useState(false);
    const [onTheMove, setOnTheMove] = useState(false);
    const [firstPosterMotionValue, setFirstPosterMotionValue] = useState<MotionValue | undefined>(undefined);
    const [offset3Factor, setOffset3Factor] = useState<number>(0.5);
    const [isMobileDevice, setIsMobileDevice] = useState(true);
    const [isTouchDevice, setIsTouchDevice] = useState(true);
    const [deviceDetected, setDeviceDetected] = useState(false);
    const [sceneModulesReady, setSceneModulesReady] = useState(false);
    const [lamps15Count, setLamps15Count] = useState(0);
    const [lamps2Count, setLamps2Count] = useState(0);
    const [groundTexturesCount, setGroundTexturesCount] = useState(4);
    const [frontItemsCount, setFrontItemsCount] = useState(1);
    const [dimensionWidth, setDimensionWidth] = useState(0);

    const hasMovedRef = useRef(false), hasFocusRef = useRef(true), showSwiperRef = useRef(showSwiper), idleAnimRef = useRef<AnimationPlaybackControls | undefined>(undefined);
    const home = useRef<HTMLDivElement>(null), root = useRef<HTMLDivElement>(null), subroot = useRef<HTMLDivElement>(null);
    const layer0 = useRef<HTMLDivElement>(null), layer0_25 = useRef<HTMLDivElement>(null), layer0_5 = useRef<HTMLDivElement>(null), layer1 = useRef<HTMLDivElement>(null), layer1_5 = useRef(null), layer2 = useRef<HTMLDivElement>(null), layer3 = useRef<HTMLDivElement>(null);
    const firstAlbum = useRef<HTMLImageElement>(null), firstPoster = useRef<HTMLImageElement>(null);
    const resolveScrollRef = useRef<(() => void) | null>(null);
    const anchorScrollDoneRef = useRef(false);
    const seasonWorkerRef = useRef<Worker | null>(null);
    const seasonFetchStartedRef = useRef(false);

    const { setPlaying, isPlaying, setAutoplay, playingEpisode } = usePlayback();
    const router = useRouter();
    const [isPresent, safeToRemove] = usePresence();

    // eslint-disable-next-line react-hooks/refs -- intentional: ref snapshot used in effect dep arrays to track when the firstAlbum DOM node is attached
    const firstAlbumImg = firstAlbum.current;

    function isMobileLandscape() {
        // Use local state (set from UA check in the init useEffect) rather than
        // the module-scope react-device-detect value, which is wrong during SSR.
        // Guard window access — this can be called from useTransform callbacks
        // which now run server-side in newer framer-motion/Next.js versions.
        if (typeof window === "undefined") return false;
        return isMobileDevice && window.innerWidth > window.innerHeight;
    }

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (window.Worker && ready && !seasonFetchStartedRef.current) {
            timeout = setTimeout(() => {
                if (seasonFetchStartedRef.current) return;
                seasonFetchStartedRef.current = true;
                console.log("fetching seasons");
                const worker = new Worker(`/js/seasonFetcher.js?buildId=${encodeURIComponent(BUILD_ID)}`);
                seasonWorkerRef.current = worker;
                worker.onmessage = function (e) {
                    const payload = e.data;
                    const fetchedSeasons = Array.isArray(payload) ? payload : payload?.seasons;
                    if (!Array.isArray(fetchedSeasons)) return;

                    requestAnimationFrame(() => setSeasons([{ name: "", episodes: [] }, ...fetchedSeasons]));
                    if (Array.isArray(payload) || payload.source === 'network') {
                        localStorage.setItem('seasons', JSON.stringify(fetchedSeasons));
                    }
                    if (payload?.source === 'network') {
                        worker.terminate();
                        if (seasonWorkerRef.current === worker) seasonWorkerRef.current = null;
                    }
                };
                worker.postMessage({
                    buildId: BUILD_ID,
                    cachedSeasons: localStorage.getItem('seasons') || '[]',
                });
            }, onTheMove || router.asPath.includes("#") ? 0 : SEASON_FETCH_DELAY_MS);
        }

        return () => {
            clearTimeout(timeout);
        };
    }, [ready, onTheMove, router.asPath]);

    useEffect(() => () => {
        seasonWorkerRef.current?.terminate();
        seasonWorkerRef.current = null;
    }, []);

    useEffect(() => {
        let resizeFrame = 0;
        const handleResize = () => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                // Read all geometry first, then commit the related state writes
                // together so none of them invalidates a later measurement.
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const width = home.current?.clientWidth || viewportWidth;
                const mobileLandscape = isMobileDevice && viewportWidth > viewportHeight;
                const maxDimension = Math.max(viewportWidth, viewportHeight);
                const lampCount = (factor: number) => {
                    const lampWidth = factor * viewportHeight * 0.45 * (2233 / 2291);
                    const gapWidth = maxDimension * (isMobileDevice ? 1.75 : 1) - lampWidth;
                    return Math.floor(width / (lampWidth + gapWidth)) + 1;
                };
                const textureWidth = (3618 / 858) * viewportHeight;
                const frontItemWidth = 0.8 * viewportHeight;
                const frontGap = Math.max(2.75 * viewportWidth, 5.38 * viewportHeight);

                setRatio(width / ((mobileLandscape ? viewportHeight : viewportWidth) || 1));
                setOffset3Factor(viewportHeight <= viewportWidth ? 2 : Math.round(2 + (1.5 * (viewportHeight / viewportWidth))));
                setLamps15Count(lampCount(LAMP_FACTOR_LAYER_1_5));
                setLamps2Count(lampCount(LAMP_FACTOR_LAYER_2));
                setGroundTexturesCount(Math.ceil(Math.ceil(width / textureWidth) * 1.3));
                setFrontItemsCount(Math.ceil(width / (frontItemWidth + frontGap)));
                setDimensionWidth((mobileLandscape ? viewportHeight : viewportWidth) || 0);
            });
        };

        window.addEventListener('resize', handleResize, { passive: true });
        handleResize();

        return () => {
            cancelAnimationFrame(resizeFrame);
            window.removeEventListener('resize', handleResize);
        };
    }, [isMobileDevice, seasons.length]);

    const { scrollX, scrollY } = useScroll();
    const scrollXAdditional = useMotionValue(0);
    const scrollYAdditional = useMotionValue(0);
    var newScrollX: MotionValue = useTransform(() => {
        if (!subroot?.current) return 0;

        let limit = (home.current?.clientWidth || 0) > window.innerWidth ?
            (home.current?.clientWidth || window.innerWidth) - window.innerWidth : 0;

        const scrollSum = scrollX.get() + scrollY.get() + (scrollXAdditional.get() || 0) + scrollYAdditional.get();
        // console.log("useTransform newScrollX", scrollSum, scrollX.get(), scrollY.get(), scrollXAdditional.get(), scrollYAdditional.get());

        if (isTouchDevice) {
            if (showSwiper && scrollSum != 0) setShowSwiper(false);
            const smallerDim = Math.min(window.innerWidth, window.innerHeight);
            limit = (home.current?.clientWidth || smallerDim) - smallerDim;
            if (scrollX.get() >= limit) {
                window.scrollTo({
                    left: limit,
                    behavior: "instant"
                });
            }
        }

        if (scrollSum < 0) {
            console.log("Negative scroll - reset");
            window.scrollTo({
                left: 0,
                behavior: "instant"
            });
            scrollXAdditional.set(0);
            scrollYAdditional.set(0);
            // eslint-disable-next-line react-hooks/immutability -- intentional: self-referential MotionValue; newScrollX is declared in the same scope and the typeof guard prevents TDZ access
            return typeof (newScrollX) !== "undefined" ? Math.floor(newScrollX.get() / 2) : 0;
        } else if (scrollSum > limit) {
            console.log("Overscroll", scrollSum, scrollX.get(), scrollY.get(), limit, scrollSum - limit);
            return -limit;
        }

        if (typeof window === "undefined") {
            console.warn("undefined window", -scrollSum);
            return -scrollSum;
        };
        const output = -Math.min(scrollSum, limit);
        return output;
    });

    const centerPosition = useTransform(() => `calc(${((isMobileDevice ? (isMobileLandscape() ? scrollY : scrollX) : newScrollX).get() / (home.current?.clientWidth || 100)) * (isMobileDevice ? 200 : -100)}% + ${dimensionWidth / 2}px)`);
    const perspectiveOrigin = useTransform(() => `${centerPosition.get()} 11.5v${isMobileLandscape() ? "max" : "h"}`);
    // Use isTouchDevice state (set client-side in useEffect) instead of
    // navigator.maxTouchPoints directly — useTransform callbacks now run server-side
    // in newer framer-motion/Next.js, so we can't access navigator here safely.
    const offsetFloor = useTransform(() => newScrollX.get() * FLOOR_PARALLAX_FACTOR * (isTouchDevice ? 2 : 1));
    const offset15 = useTransform(() => newScrollX.get() * LAYER_1_5_PARALLAX_FACTOR * (isTouchDevice ? 2 : 1));
    const offset2 = useTransform(() => newScrollX.get() * LAYER_2_PARALLAX_FACTOR * (isTouchDevice ? 2 : 1));
    const offset3 = useTransform(() => newScrollX.get() * offset3Factor);

    const [invisibleSeasonSeparators, setInvisibleSeasonSeparators] = useState<number[]>([]);

    useLayoutEffect(() => {
        const measure = () => {
            setInvisibleSeasonSeparators(
                [...(seasons || [])].map((_, i) =>
                    layer1.current?.children[i]?.children[0]?.getBoundingClientRect()?.width || 1000
                )
            );
        };
        measure();
        const observer = new ResizeObserver(measure);
        if (layer1.current) observer.observe(layer1.current);
        return () => observer.disconnect();
    }, [seasons]);

    const interceptAutoScroll = useCallback((e: MouseEvent) => {
        if (e.button == 1) {
            e.preventDefault()
            console.log(e)
        }
    }, []);

    const isPlayerVisible = useCallback(() => {
        if (isMobileDevice) return false;
        const active = playingEpisode && playingEpisode.mp3 && playingEpisode.num && playingEpisode.title;
        return !!active;
    }, [isMobileDevice, playingEpisode]);

    const handleKeysDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        const scroll = Math.floor(window.innerWidth * 0.06);
        if (e.keyCode >= 37 && e.keyCode <= 40) {
            e.preventDefault();
            setShowSwiper(false);
            hasMovedRef.current = true;
            idleAnimRef.current?.stop();
        }
        switch (e.keyCode) {
            case 38: // up arrow
            case 37: // left arrow
                animate(scrollXAdditional, Math.max(0, scrollXAdditional.get() - scroll), { duration: 0.075 });
                break;
            case 39: // Right Arrow
            case 40: // Down Arrow
                const limit = (home.current?.clientWidth || window.innerWidth) - window.innerWidth;
                animate(scrollXAdditional, Math.min(scrollXAdditional.get() + scroll, limit), { duration: 0.075 });
                break;
            case 32:
                e.preventDefault();
                setPlaying(playing => !playing);
                break;
        }
    }, [scrollXAdditional, setShowSwiper, hasMovedRef, idleAnimRef, home, setPlaying]);

    useEffect(() => {
        const slider = home.current;
        if (!slider || isMobileDevice) return;
        let isDown = false;
        let startX: number;
        let scrollLeft: number;
        let previousScrollX: number;
        let limit = 0;

        const onMouseDown = (e: MouseEvent) => {
            isDown = true;
            limit = slider.clientWidth - window.innerWidth;
            slider.classList.add(styles.grab);
            startX = e.pageX - scrollX.get();
            scrollLeft = scrollXAdditional.get();
            cancelMomentumTracking();
        };

        const onMouseLeave = () => {
            isDown = false;
            slider.classList.remove(styles.grab);
        };

        const onMouseUp = () => {
            isDown = false;
            slider.classList.remove(styles.grab);
            beginMomentumTracking();
        };

        const onMouseMove = (e: MouseEvent) => {
            if (!isDown) return;
            console.log("mouseGrab move");
            e.preventDefault();
            if (Math.abs(scrollXAdditional.get()) > 100) {
                hasMovedRef.current = true;
                idleAnimRef.current?.stop();
            }
            const x = e.pageX - scrollX.get();
            const walk = (x - startX) * 2; //scroll-fast
            scrollXAdditional.set(Math.min(limit, scrollLeft - walk) || 0);
            setTimeout(() => {
                previousScrollX = Math.min(scrollXAdditional.get(), limit);
            }, 200);
            velX = scrollXAdditional.get() - previousScrollX;
            console.log(velX, scrollXAdditional.get(), previousScrollX, limit);
            if (velX < 0) console.log(velX, scrollXAdditional.get(), previousScrollX);
        };

        const onWheel = () => {
            console.log("wheel cancel Momentum tracking");
            cancelMomentumTracking();
        };

        slider.addEventListener('mousedown', onMouseDown);
        slider.addEventListener('mouseleave', onMouseLeave);
        slider.addEventListener('mouseup', onMouseUp);
        slider.addEventListener('mousemove', onMouseMove);
        window.addEventListener('wheel', onWheel, { passive: true });

        // Momentum 
        var velX = 0;
        var momentumID: number;

        function beginMomentumTracking() {
            cancelMomentumTracking();
            momentumID = requestAnimationFrame(momentumLoop);
        }
        function cancelMomentumTracking() {
            cancelAnimationFrame(momentumID);
        }
        function momentumLoop() {
            scrollXAdditional.set(scrollXAdditional.get() + velX);
            velX *= 0.66;
            if (Math.abs(velX) > 0.5) {
                momentumID = requestAnimationFrame(momentumLoop);
            }
        }

        return () => {
            slider.removeEventListener('mousedown', onMouseDown);
            slider.removeEventListener('mouseleave', onMouseLeave);
            slider.removeEventListener('mouseup', onMouseUp);
            slider.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('wheel', onWheel);
            cancelMomentumTracking();
        }
    }, [isMobileDevice, scrollX, scrollXAdditional, firstAlbumImg]);

    useEffect(() => {
        const rootElem = root.current;
        if (!ready || !rootElem || isMobileDevice) return;

        const onHomeWheel = (e: WheelEvent) => {
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
            // console.log("wheel", e.deltaX, e.deltaY, e.deltaZ, isTouchDevice);
            if (isTouchDevice) {
                console.log("isTouchDevice", isTouchDevice);
                scrollXAdditional.set(0);
                scrollYAdditional.set(0);

                window.scrollTo({
                    left: 0,
                    top: 0,
                    behavior: "instant"
                });
                return;
            }

            const limit = (home.current?.clientWidth || window.innerWidth) - window.innerWidth;
            const { deltaX, deltaY } = e;

            // console.log(newScrollX.get(), -limit, home.current?.clientWidth, window.innerWidth);
            if (newScrollX.get() <= -limit && deltaX + deltaY > 0) {
                console.log("BLOCK! A", deltaX + deltaY);
                scrollXAdditional.set(limit);
                scrollYAdditional.set(0);
                hasMovedRef.current = true;
                window.scrollTo({
                    left: 0,
                    top: 0,
                    behavior: "instant"
                });
            } else if (newScrollX.get() >= -1 && deltaX + deltaY < 0) {
                console.log("BLOCK! B", deltaX + deltaY);
                if (deltaY < 0 && scrollYAdditional.get() + deltaY < 0) scrollYAdditional.set(0);
                if (deltaX < 0 && scrollXAdditional.get() + deltaX < 0) scrollXAdditional.set(0);
                return;
            } else {
                if (deltaY !== 0 && Math.abs(deltaY) > Math.abs(deltaX)) scrollYAdditional.set((scrollYAdditional.get() || 0) + deltaY);
                else if (deltaX !== 0) scrollXAdditional.set((scrollXAdditional.get() || 0) + deltaX);
                // console.log("moving through wheel", scrollXAdditional.get(), scrollYAdditional.get());
                setColumnFocus(false);
                setShowSwiper(false);
                idleAnimRef.current?.stop();
                hasMovedRef.current = true;
            }
            if (e.ctrlKey) return;
            e.preventDefault();
        };

        const onFocus = () => {
            hasFocusRef.current = true;
        };

        const onBlur = () => {
            hasFocusRef.current = false;
        };

        window.addEventListener("focus", onFocus, { passive: true });
        window.addEventListener("blur", onBlur, { passive: true });
        rootElem?.addEventListener("wheel", onHomeWheel, { passive: false });
        rootElem?.addEventListener("mousedown", interceptAutoScroll, { passive: false });
        let swiperTimer: NodeJS.Timeout | undefined = undefined;
        const idleAnimAction = () => {
            const hasMovedCount = Number(localStorage.getItem("hasMovedHome") || "0");
            if (!hasMovedRef.current && hasMovedCount <= 2) {
                if (!isTouchDevice && hasFocusRef.current && document.hasFocus()) {
                    const from = scrollXAdditional.get(), to = scrollXAdditional.get() + Math.floor(window.innerWidth / 11);
                    const anim = animate([[scrollXAdditional, to, {
                        duration: 0.9,
                        ease: "easeIn"
                    }], [scrollXAdditional, [to, from], {
                        duration: 0.9,
                        delay: 0.5,
                        ease: "easeInOut"
                    }], [scrollXAdditional, from, {
                        duration: 0,
                        delay: 0.25
                    }]]);
                    idleAnimRef.current = anim;
                    idleAnimRef.current.finished.then(() => {
                        hasMovedRef.current = false;
                        setShowSwiper(false);
                    });
                    setShowSwiper(true);
                } else if (!hasFocusRef.current) {
                    setShowSwiper(false);
                } else {
                    setShowSwiper(true);
                }
            } else {
                if (hasMovedCount < 3) localStorage.setItem("hasMovedHome", (hasMovedCount + 1).toString());
                clearInterval(swiperTimer);
            }
        };
        swiperTimer = setTimeout(() => {
            idleAnimAction();
            swiperTimer = setInterval(idleAnimAction, IDLE_SWIPE_REPEAT_MS);
        }, IDLE_SWIPE_INITIAL_DELAY_MS);
        home.current?.focus();
        return () => {
            clearInterval(swiperTimer);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("blur", onBlur);
            rootElem?.removeEventListener("wheel", onHomeWheel);
            rootElem?.removeEventListener("mousedown", interceptAutoScroll);
        }
    }, [home, ready, isMobileDevice, scrollYAdditional, isTouchDevice, interceptAutoScroll, scrollXAdditional, newScrollX]);

    useEffect(() => {
        const motionValue = isMobileDevice ? newScrollX : scrollXAdditional;
        const unsub = motionValue.on("change", (val) => {
            if (Math.abs(val) > 50) {
                hasMovedRef.current = true;
                if (Math.abs(val) > 1000) {
                    setOnTheMove(true);
                    if (unsub) unsub();
                }
            }
        });

        return () => {
            unsub();
        }
    }, [isMobileDevice, newScrollX, scrollXAdditional])

    useEffect(() => {
        if (ready || !deviceDetected || !sceneModulesReady || seasons.length === 0 || !root.current) return;

        let cancelled = false;
        let anchorTimeout: ReturnType<typeof setTimeout> | undefined;
        const anchorPromise = !router.asPath.includes("#") || anchorScrollDoneRef.current
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                const finish = () => {
                    if (anchorTimeout) clearTimeout(anchorTimeout);
                    resolveScrollRef.current = null;
                    resolve();
                };
                resolveScrollRef.current = finish;
                anchorTimeout = setTimeout(finish, 4_000);
            });

        const revealWhenComplete = async () => {
            const [scene] = await Promise.all([
                waitForInitialScene({ root: root.current as HTMLDivElement, timeoutMs: 12_000 }),
                anchorPromise,
            ]);
            if (cancelled) return;
            if (scene.timedOut) console.warn(`Initial homepage scene timed out after finding ${scene.imageCount} images`);
            setReady(true);
            if (isPresent) onPageReady();
        };

        revealWhenComplete().catch(console.error);
        return () => {
            cancelled = true;
            if (anchorTimeout) clearTimeout(anchorTimeout);
            resolveScrollRef.current = null;
        };
    }, [deviceDetected, isPresent, onPageReady, ready, router.asPath, sceneModulesReady, seasons.length]);

    useEffect(() => {
        // Detect the device first, then fetch only the decorative modules this
        // device can render. Readiness cannot begin until those modules resolve.
        const mobile = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only capability detection cannot be known during static export
        setIsMobileDevice(mobile);
        setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
        setDeviceDetected(true);

        if (mobile) {
            setSceneModulesReady(true);
            return () => { cancelled = true; };
        }

        Promise.all([
            loadPlantA(),
            loadEggchair(),
            loadPlantB(),
            loadPlantD(),
            loadPlantE(),
            loadFrontColumn(),
        ]).then(([, , , , , frontColumnModule]) => {
            if (cancelled) return;
            setFrontPosters(frontColumnModule.FrontPosters);
            setSceneModulesReady(true);
        }).catch(console.error);

        return () => { cancelled = true; };
    }, []);

    return (
        <motion.div
            key="transition_loader"
            data-testid="home-scene"
            initial={{ opacity: 0.001, visibility: 'hidden' }}
            animate={{ opacity: ready ? 1 : 0.001, visibility: 'visible' }}
            exit={{ opacity: 0, visibility: 'hidden' }}
            transition={{ type: 'tween', duration: 0.25 }}
            onAnimationComplete={(animDef: { opacity: number }) => {
                if (!isPresent && animDef.opacity === 0) {
                    setReady(false);
                    safeToRemove();
                }

                if (isPresent) console.log("Home visible", animDef);
                else console.log("Home invisible", animDef);
            }}
            style={{
                ...props.style
            }}
            className="transition_loader" >
            <Head>
                {generateNextSeo({
                    title: `Septante Minutes Avec`,
                    description: "Podcast politique belge, couvrant les sujets de sociétés. Des questions de genre à la neurodiversité, en passant par la technologie et la géopolitique.",
                    openGraph: {
                        url: `https://www.septanteminutes.be`,
                        title: `Septante Minutes Avec`,
                        description: "Podcast politique belge, couvrant les sujets de sociétés. Des questions de genre à la neurodiversité, en passant par la technologie et la géopolitique.",
                        locale: "fr_BE",
                        images: [{
                            url: "https://res.cloudinary.com/dcodwkhcg/image/upload/v1722887962/opengraph.jpg",
                            width: 2048,
                            height: 2048,
                            alt: `Logo Septante Minutes Avec`
                        }],
                        siteName: "Septante Minutes Avec",
                    },
                    twitter: {
                        handle: "@SeptanteMinutes",
                        site: "@SeptanteMinutes",
                        cardType: "summary_large_image",
                    },
                })}
            </Head>
            <div ref={subroot} className={styles.home_subroot} id="subroot" key={"home_subroot"}>
                <div ref={root} className={styles.home_root} key={"home_root"}>
                    <motion.div className={styles.home} key={"home"} ref={home} tabIndex={0} id="home"
                        onKeyDown={handleKeysDown} style={{ translateX: newScrollX, translateZ: 0 }}>
                        <Head>
                            <title>{playingEpisode?.title ? `${isPlaying ? "▶ " : ""}${playingEpisode?.title}` : "Septante Minutes Avec"}</title>
                            <script type='application/ld+json' dangerouslySetInnerHTML={ { __html: structuredObject}} />
                            </Head>
                        <motion.div key="layer_0" ref={layer0} className={[styles.layer_0, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} >
                            <div className={styles.ceiling} key={"ceiling"}>
                                {[...Array(groundTexturesCount)].map((_, i) => (
                                    <div key={`ceiling_${i}`} style={{ aspectRatio: 3618 / 858, width: "auto", height: "100vh", position: "relative" }}>
                                        <Image draggable="false" data-initial-scene="true" loading={isMobileDevice ? "lazy" : "eager"} fetchPriority={!isMobileDevice && i === 0 ? "high" : undefined} quality={55} src="https://framerusercontent.com/images/N99SQvccncY8lkqgpW8uypkR1E.png" alt="" style={{ transform: `scale(${i % 2 ? -1 : 1}, 1)` }} fill sizes="min(422vh, 100vw)" />
                                    </div>
                                ))}
                            </div>
                            <div className={styles.backwall} key={"backwall"}>
                                <motion.div className={styles.backwall_paint} key={"backwall_paint"} />
                                <motion.div className={styles.posters} key={"posters"} style={{ translateZ: "0px", translateY: "-50%" }}>
                                    {
                                        seasons.map((season, i) => {
                                            const left = invisibleSeasonSeparators.slice(0, i + 1).reduce((sum, value) => sum + value, 0);
                                            return (<React.Fragment key={season.name + "_invisible00_fragment"}>
                                                <Poster setFirstPosterMotionValue={setFirstPosterMotionValue} ref={i == 0 ? firstPoster : undefined} offset={left} className={[styles.poster, posters[i].className].join(" ")} key={`${season.name}_poster_${i}_${invisibleSeasonSeparators[i]}`}
                                                    initialScene priority={!isMobileDevice && (ready || i == 0)} poster={posters[i]} isLast={i == seasons.length - 1} motionValue={newScrollX} position={i} />
                                            </React.Fragment>)
                                        })
                                    }
                                </motion.div>
                                <BackwallLight initialScene className={styles.backwall_light} key="backwall_light" offset={firstPosterMotionValue} />
                            </div>
                        </motion.div>
                        <motion.div key="layer_0_25" ref={layer0_25} className={[styles.layer_0_25, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ translateX: offsetFloor, width: "130%" }}  >
                            <motion.div>
                                <motion.div style={{ perspectiveOrigin: perspectiveOrigin }}>
                                    <motion.div className={styles.floor} key={"floor"}>
                                        {[...Array(groundTexturesCount)].map((_, i) => (
                                            <div key={`floor_${i}`}>
                                                <Image draggable="false" data-initial-scene="true" loading="lazy" quality={50} src="https://framerusercontent.com/images/WJ4GoOiClG5Vma3Y4Hi0CrGffag.jpg" alt="" style={{ transform: `scale(${i % 2 ? -1 : 1}, 1)` }} fill sizes={isMobileDevice ? "100vmax" : "100vh"} />
                                            </div>
                                        ))}
                                    </motion.div>
                                </motion.div>
                            </motion.div>
                        </motion.div>
                        {
                            !isMobileDevice && <motion.div key="layer_0_5" ref={layer0_5} className={[styles.layer_0_5, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")} style={{ transform: "translateX(0px)" }}>
                                {seasons.map((season, i) => (
                                    <React.Fragment key={season.name + "_invisible05_Fragment_"}>
                                        <div key={season.name + "_invisible05"} style={{ width: `calc((${invisibleSeasonSeparators[i]}px - (85vh / 4.5)) * 0.938842)` }} />
                                        {
                                            [
                                                (<React.Fragment key={`deco05_0_${i}_separatedby_${invisibleSeasonSeparators[i]}`}>
                                                    <PlantD initialScene key={`layer05_prop_${i}_PlantD`} className={styles.plant} style={{ zIndex: 2, left: "-5vh" }} motionValue={newScrollX} position={i} />
                                                    <Eggchair initialScene key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} motionValue={newScrollX} position={i} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_1_${i}_separatedby_${invisibleSeasonSeparators[i]}`}>
                                                    <Eggchair initialScene key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: undefined }} motionValue={newScrollX} position={i} />
                                                    <PlantA initialScene key={`layer05_prop_${i}_PlantA`} className={[styles.plant, styles.left_m15].join(" ")} motionValue={newScrollX} position={i} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_2_${i}_separatedby_${invisibleSeasonSeparators[i]}`}>
                                                    <PlantB initialScene key={`layer05_prop_${i}_PlantB`} className={[styles.plant, styles.left_m15].join(" ")} motionValue={newScrollX} position={i} />
                                                    <Eggchair initialScene key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: undefined }} motionValue={newScrollX} position={i} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_3_${i}_separatedby_${invisibleSeasonSeparators[i]}`}>
                                                    <PlantE initialScene key={`layer05_prop_${i}_PlantE`} className={[styles.plant, styles.left_m30].join(" ")} style={{ zIndex: 2, left: "-10vh" }} motionValue={newScrollX} position={i} />
                                                    <Eggchair initialScene key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: "" }} motionValue={newScrollX} position={i} />
                                                </ React.Fragment>),
                                                (<React.Fragment key={`deco05_4_${i}_separatedby_${invisibleSeasonSeparators[i]}`}>
                                                    <div key={`layer05_gap0_${i}_div`} className={styles.gap} style={{ width: "calc(55 * var(--unit))" }} />
                                                    <Eggchair initialScene key={`layer05_prop_${i}_Eggchair`} className={styles.eggchair} style={{ zIndex: 2, left: undefined }} motionValue={newScrollX} position={i} />
                                                    <PlantB initialScene key={`layer05_prop_${i}_PlantB`} className={[styles.plant, styles.left_m15].join(" ")} motionValue={newScrollX} position={i} />
                                                </ React.Fragment>)
                                            ][i % 5]
                                        }
                                    </ React.Fragment>
                                ))}
                            </motion.div>
                        }
                        <motion.div key="layer_1" ref={layer1} className={[styles.layer_1, styles.layer, columnFocus ? styles.blur16 : styles.blurReady].join(" ")}>
                            {
                                seasons.map((season, i) => (
                                    <Season initialScene key={`${season.name}_visible1`} seasonTitle={season.name} ready={ready} position={i} playerVisible={isPlayerVisible()}
                                        motionValue={newScrollX} chair={isMobileDevice || i == 0 ? null : Chairs[i % 4]} className={styles.season_frame}>
                                        {season.episodes.slice().reverse().map((ep: Episode, j: number) => (
                                            <HomeAlbum id={`art_${ep.num}`} imageRef={((i == 0 && j == 0 && !router.asPath.includes("#")) || router.asPath.split("#")[1] === ep.num) ? firstAlbum : null} guest={ep.title} key={`${ep.num}_visible1`} image={ep.img} num={ep.num}
                                                initialScene={(i == 0 && j == 0 && !router.asPath.includes("#")) || router.asPath.split("#")[1] === ep.num}
                                                fetchPriority={isMobileDevice && ((i == 0 && j == 0 && !router.asPath.includes("#")) || router.asPath.split("#")[1] === ep.num) ? "high" : undefined}
                                                onClick={(e: MouseEvent) => {
                                                    if (e.button != 0) return;
                                                    if (process.env.NODE_ENV === 'production') setAutoplay(ep);
                                                }} />
                                        ))}
                                    </Season>
                                ))
                            }
                        </motion.div>
                        <motion.div key="layer_1_5" ref={layer1_5} className={[styles.layer_1_5, styles.layer, columnFocus ? styles.blur16 : styles.blurReady, styles.lamps_1_5].join(" ")} style={{ translateX: offset15 }}>
                            {[...Array(lamps15Count)].map((_, i: number) => (
                                <React.Fragment key={`lamps_1_5_${i}`}>
                                    <BellLamp initialScene key={`lamp_1_5_${i}_A`} className={styles.lamp} />
                                    <BellLamp initialScene key={`lamp_1_5_${i}_B`} className={styles.lamp} />
                                </React.Fragment>
                            ))}
                        </motion.div>
                        <motion.div key="layer_2" ref={layer2} className={[styles.layer_2, styles.layer, columnFocus ? styles.blur16 : styles.blurReady, styles.lamps_2].join(" ")} style={{ translateX: offset2 }}>
                            {[...Array(lamps2Count)].map((_, i: number) => (
                                <React.Fragment key={`lamps_2_${i}`}>
                                    <BellLamp initialScene key={`lamp_2_${i}_A`} className={styles.lamp} />
                                    <BellLamp initialScene key={`lamp_2_${i}_B`} className={styles.lamp} />
                                </React.Fragment>
                            ))}
                        </motion.div>
                        <div key="layer_3" className={[styles.layer, styles.layer_3_wrapper].join(" ")}>
                            {frontPosters.length > 0 && <motion.div ref={layer3} className={[styles.layer_3, styles.layer].join(" ")} style={{ translateX: offset3, translateZ: "20px" }}>
                                <PlantA2 initialScene key={`layer3_prop_-1_PlantA2`} className={[styles.plant_front, columnFocus ? styles.blurReady : styles.blur8].join(" ")} />
                                {[...Array(frontItemsCount)].map((_, i: number) => (
                                    <React.Fragment key={`layer3_deco_${i}`}>
                                        {!isMobileDevice && (<FrontColumn key={`layer3_prop_${i}_FrontColumn`} className={[styles.front_column, columnFocus ? "" : styles.blur8].join(" ")}
                                            pic={frontPosters[i % 4].img} subtitle={frontPosters[i % 4].text} ratio={frontPosters[i % 4].ratio} date={frontPosters[i % 4].date} blur={frontPosters[i % 4].blurDataUrl}
                                            initialScene priority={ready} onMouseMove={() => { setColumnFocus(true) }} onMouseLeave={() => { setColumnFocus(false) }} />)}
                                        <PlantA2 initialScene key={`layer3_prop_${i}_PlantA2`} className={[styles.plant_front, columnFocus ? styles.blurReady : styles.blur8].join(" ")} />
                                    </ React.Fragment>
                                ))}
                            </motion.div>}
                        </div>
                        { !isTouchDevice && <SwipeAnim play={showSwiper} className={styles.swipe_anim} key={"swipe_anim"} />}
                    </motion.div>
                </div>
                <ScrollToAnchor move={(x: number) => {
                    if (x > 0) {
                        x = Math.min(x, (home.current?.clientWidth || window.innerWidth) - window.innerWidth);
                        if (isTouchDevice) {
                            window.scrollBy({
                                left: x / 2,
                                behavior: "instant"
                            });
                        } else {
                            animate([[scrollXAdditional, x, {
                                duration: 0.1,
                                delay: 0
                            }]]);
                        }
                        // console.log("scrolled", x);
                    }
                    hasMovedRef.current = false;
                    anchorScrollDoneRef.current = true;
                    if (resolveScrollRef.current) resolveScrollRef.current();
                }} />
            </div>
        </motion.div>
    );
}

export const getStaticProps = (async (_) => {
    const mod = await import("@/../public/js/data.json");
    const { episodes } = mod;

    const eps = episodes as Record<string, Episode>;
    const vinyls = Array.from(
        { length: Object.keys(episodes).length },
        (_, k) => eps[(k + 1).toString()]
    );
    const seasons = [...new Set(vinyls.map(v => v.season))].map(season => ({
        name: season,
        episodes: vinyls.filter(ep => ep.season === season)
    }));
    seasons.reverse();
  
    return { props: { seasons: [{ name: "", episodes: [] }, ...(seasons.slice(0, 3)) ]} }
  }) satisfies GetStaticProps<{
  }>;

import React, { ReactElement, ReactNode, StrictMode, useEffect, useState } from 'react'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import Head from 'next/head'
import type { AppProps } from 'next/app'
import { AnimatePresence } from 'framer-motion'

import { PlaybackProvider } from '../utils/PlayerContext'
import FloatingPlaybackControls from "../components/FloatingPlaybackControls"
import LoadingAnim from "../components/LoadingAnim"

import styles from "./layout.module.css"
import { isMobile } from 'react-device-detect'

export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {

  const [loaded, setLoaded] = useState("");
  const [showLoadingAnim, setShowLoadingAnim] = useState(true);
  const [loaderClass, setLoaderClass] = useState("vinyl_loading");
  const [isMobileDevice, setIsMobileDevice] = useState(true);

  const { pathname } = useRouter();

  useEffect(() => {
    setIsMobileDevice(isMobile);
    let timeoutId: (NodeJS.Timeout | undefined) = undefined;
    const loader = document.getElementById('globalLoader');
    if (loader) {
      if (!loaded) {
        timeoutId = setTimeout(() => {
          if (loader.className) {
            setLoaderClass("vinyl_loading");
            setShowLoadingAnim(true);
          }
        }, 100);
      } else {
        setLoaderClass("vinyl_loading vinyl_hidden");
        timeoutId = setTimeout(() => {
          if ("requestIdleCallback" in window) {
            requestIdleCallback(() => {
              setShowLoadingAnim(false);
            });
          } else setShowLoadingAnim(false);
        }, 2000);
      }
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [loaded]);

  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout ?? ((page) => page)

  return getLayout(
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=2.0, user-scalable=yes"></meta>
        <style>
          {`
          :root {
            --tableMinHeight: 390px;
            --tableMinWidth: 790px;
            font-size: 16px;
          }
        
        @media screen and (min-height: 1081px) and (max-height: 1440px) {
            :root {
                font-size: 22px;
                /* Adjust root font size for large screens */
            }
        }
        
        @media screen and (min-height: 1441px) and (max-height: 2000px) {
            :root {
                font-size: 24px;
                /* Adjust root font size for larger screens */
            }
        }
        
        @media (min-height: 2000px) {
            :root {
                font-size: 34px;
            }
        }
        
        html, * {
            /* Hide scrollbar (firefox) */
            scrollbar-width: none;
            /* remove highlight on click (mobile) */
            -webkit-tap-highlight-color: transparent;
        }
        
        body {
            margin: 0;
            display: revert !important;
        }
        
        html, body, #__next {
            height: 100vh !important;
            height: 100svh !important;
        }
        
        html *::-webkit-scrollbar {
            display: none;
        }
        
        *:not(div[role="dialog"] *)::-moz-selection {
            background-color: transparent;
            color: #000;
        }
        
        *:not(div[role="dialog"] *)::selection {
            background-color: transparent;
            color: #000;
        }
        
        * {
            /* backface-visibility: hidden !important;
            -webkit-backface-visibility: hidden !important; */
            scroll-behavior: auto;
            overscroll-behavior-y: none;
        }
        
        .transition_loader {
            pointer-events: initial !important;
            background-color: white !important;
            position: sticky;
        }
        
        #globalLoader, .transition_loader {
            width: 100vw;
            height: 100vh;
            height: 100svh;
            background-color: white;
            opacity: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            top: 0;
            bottom: 1px;
            transition: opacity 0.8s cubic-bezier(0.390, 0.575, 0.565, 1.000);
            transition-delay: 0.25s !important;
        }
        
        @media (pointer:coarse) and (orientation: portrait) {
            html,
            body,
            #__next {
                height: 100vh !important;
                height: 100svh !important;
            }
        
            #__next {
                overflow-y: clip;
                overflow-x: unset;
            }
        }
        
        @media (pointer:coarse) and (orientation: landscape) {
            html,
            body,
            #__next {
                height: 100vh !important;
                height: 100svh !important;
            }
        
            #__next {
                overflow-y: unset;
                overflow-x: unset;
            }
        }
        
        @media (prefers-color-scheme: dark) and (pointer:coarse) {
            body {
                background-color: black;
            }
        }
        
        @media screen and (min-width: 320px) and (max-width: 1200px) and (orientation: landscape) {}
          `}
        </style>
      </Head>
      <StrictMode>
        <PlaybackProvider>
          <AnimatePresence mode="wait">
            <Component {...pageProps} key={Component.name} ready={loaded === pathname} onReady={() => {
              setLoaded(pathname);
            }} />
          </AnimatePresence>
          {!isMobileDevice && <div className={styles.overlay} key="overlay">
            <FloatingPlaybackControls />
          </div>}
        </PlaybackProvider>
      </StrictMode>
      {showLoadingAnim ? <div id="globalLoader" style={loaded ? { opacity: 0, pointerEvents: "none", position: "fixed" } : { position: "fixed" }}>
        <LoadingAnim className={loaderClass} />
      </div> : null}
    </>
  )
}

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}
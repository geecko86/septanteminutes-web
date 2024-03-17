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
        { showLoadingAnim ? <div id="globalLoader" style={ loaded ? { opacity: 0, pointerEvents: "none", position: "fixed" } : { position: "fixed" }}>
        <LoadingAnim className={loaderClass} />
      </div> : null }
    </>
  )
}

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}
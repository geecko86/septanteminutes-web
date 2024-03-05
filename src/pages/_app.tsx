import { ReactElement, ReactNode, StrictMode, useEffect, useState } from 'react'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import Head from 'next/head'
import type { AppProps } from 'next/app'
import { AnimatePresence } from 'framer-motion'

import { PlaybackProvider } from '../utils/PlayerContext'
import FloatingPlaybackControls from "../components/FloatingPlaybackControls"
import LoadingAnim from "../components/LoadingAnim"

import styles from "./layout.module.css"

export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {

  const [loaded, setLoaded] = useState("");
  const [showSpinner, setShowSpinner] = useState(true);
  const [spinnerClass, setSpinnerClass] = useState("spinner");

  const { pathname } = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let timeoutId: (NodeJS.Timeout | undefined) = undefined;
      const loader = document.getElementById('globalLoader');
      if (loader) {
        loader.className = loaded ? 'gone' : '';
        if (!loaded) {
          timeoutId = setTimeout(() => {
            if (loader.className) {
              setSpinnerClass("spinner");
              setShowSpinner(true);
            }
          }, 100);
        } else {
          setSpinnerClass("spinner spinner_hidden");
          timeoutId = setTimeout(() => {
            if ("requestIdleCallback" in window) {
              requestIdleCallback(() => {
                setShowSpinner(false);
              });
            } else setShowSpinner(false);
          }, 2000);
        }
        return () => {
          clearTimeout(timeoutId);
        };
      }
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
          <div className={styles.overlay} key="overlay">
            <FloatingPlaybackControls />
          </div>
        </PlaybackProvider>
        </StrictMode>
      <div id="globalLoader">
        {showSpinner ? <div>
          <LoadingAnim className={spinnerClass} />
        </div> : null}
      </div>
    </>
  )
}

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}
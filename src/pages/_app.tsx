import { ReactElement, ReactNode, useEffect, useState } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import type { AppProps } from 'next/app'
import { AnimatePresence } from 'framer-motion'
import { motion } from 'framer-motion'

import { PlaybackProvider } from '../utils/PlayerContext'
import FloatingPlaybackControls from "../components/FloatingPlaybackControls"
import MaterialSpinningLoader from "../components/MaterialSpinningLoader"

import styles from "./layout.module.css"

export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {

  const [loaded, setLoaded] = useState(false);
  const [showSpinner, setShowSpinner] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      let timeoutId: (NodeJS.Timeout | undefined) = undefined;
      const loader = document.getElementById('globalLoader');
      if (loader) {
        loader.className = loaded ? 'gone' : '';
        if (!loaded) {
          timeoutId = setTimeout(() => {
            if (loader.className) setShowSpinner(true);
          }, 600);
        } else {
          timeoutId = setTimeout(() => {
            setShowSpinner(false);
          }, 2000);
        }
        if (timeoutId) return () => {
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"></meta>
      </Head>
      <PlaybackProvider>
        <AnimatePresence mode="wait" initial={false}>
          <Component {...pageProps} ready={loaded} onReady={setLoaded} />
        </AnimatePresence>
        <div className={styles.overlay} key="overlay">
          <FloatingPlaybackControls />
        </div>
      </PlaybackProvider>
      <div id="globalLoader">
        {showSpinner ? <div>
          <MaterialSpinningLoader />
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
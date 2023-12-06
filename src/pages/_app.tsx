import type { ReactElement, ReactNode } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import type { AppProps } from 'next/app'

import { PlaybackProvider } from '../utils/PlayerContext'
import FloatingPlaybackControls from "../components/FloatingPlaybackControls"

import styles from "./layout.module.css"

export default function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout ?? ((page) => page)

  return getLayout(<>
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"></meta>
    </Head>
    <PlaybackProvider>
      <Component {...pageProps} />
      <div className={styles.overlay}>
        <FloatingPlaybackControls />
      </div>
    </PlaybackProvider>
  </>
  )
}

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout
}
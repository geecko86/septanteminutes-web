"use client";

import React, { ReactElement, ReactNode, StrictMode, useCallback, useEffect, useState } from 'react'
import type { NextComponentType, NextPage, NextPageContext } from 'next'
import { useRouter } from 'next/router'
import Head from 'next/head'
import type { AppProps } from 'next/app'
import { AnimatePresence } from 'framer-motion'

import { PlaybackProvider } from '../utils/PlayerContext'
import useUpdateChecker from '../utils/updateChecker';
import FloatingPlaybackControls from "../components/FloatingPlaybackControls"
import LoadingAnim from "../components/LoadingAnim"

import styles from "./layout.module.css"
import { isMobile } from 'react-device-detect'

export default function MyApp({ Component, pageProps, statusCode }: AppPropsWithLayout) {

  const [loadedRoute, setLoaded] = useState("");
  const [_, setDisplayedComponent] = useState(Component?.name);
  const [componentHistory, setComponentHistory] = useState([Component?.name]);
  const [showLoadingAnim, setShowLoadingAnim] = useState(true);
  const [loaderClass, setLoaderClass] = useState("vinyl_loading");
  const [isMobileDevice, setIsMobileDevice] = useState(true);

  const { pathname, events: routerEvents, replace: routerReplace } = useRouter();

  const onReady = useCallback(() => {
    setLoaded(pathname)
  }, [pathname]);

  useEffect(() => {
    setDisplayedComponent(displayedComponent => {
      if (Component.name !== displayedComponent) { 
        setLoaded("");
      }
      return Component.name
    });
  }, [Component.name]);

  useEffect(() => {
    const handle404 = () => {
      // Handle the error here
      setLoaded("404");
      console.error('404 - Page not found')
    }

    const handleRouteChange = async (url: string) => {
      const response = await fetch(url)
      if (response.status === 404) handle404()
    }
    if (statusCode === 404) handle404()

    routerEvents.on('routeChangeStart', handleRouteChange)
    return () => {
      routerEvents.off('routeChangeStart', handleRouteChange)
    }
  }, [routerEvents, statusCode]);

  useEffect(() => {
    setIsMobileDevice(isMobile);
    let timeoutId: (NodeJS.Timeout | undefined) = undefined;
    const loader = document.getElementById('globalLoader');
    if (loader) {
      if (!loadedRoute) {
        timeoutId = setTimeout(() => {
          if (!loadedRoute) {
            setLoaderClass("vinyl_loading");
            setShowLoadingAnim(true);
          }
        }, componentHistory.length < 2 ? 0 : 500);
      } else {
        setLoaderClass("vinyl_loading vinyl_hidden");
        if ("requestIdleCallback" in window) {
            requestIdleCallback(() => {
              setShowLoadingAnim(false);
            });
        } else timeoutId = setTimeout(() => { setShowLoadingAnim(false) }, 100);
      }
      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [loadedRoute, componentHistory]);

  // Use the layout defined at the page level, if available
  const getLayout = Component.getLayout ?? ((page) => page)

  useUpdateChecker(() => {
    fetch(window.location.href, {
        headers: {
            Pragma: 'no-cache',
            Expires: '-1',
            'Cache-Control': 'no-cache',
        },
    });
  });

  useEffect(() => {
    if (window.location.search && routerReplace) {
      const newUrl = window.location.pathname;
      routerReplace(newUrl, undefined, { shallow: true });
    }
  }, [routerReplace]);

  return getLayout(
    <>
      <Head>
        <meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no"></meta>
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
            position: sticky;
          }
          
          #globalLoader, .transition_loader {
            width: 100vw;
            height: 100vh;
            height: 100svh;
            background-color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            top: 0;
          }

          #globalLoader {
            bottom: 1px;
            opacity: 1;
            transition: none;
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

            #globalLoader, .transition_loader {
                background-color: #303030 !important;
            }
        }
        
        @media screen and (min-width: 320px) and (max-width: 1200px) and (orientation: landscape) {}
          `}
        </style>
      </Head>
      {/* <StrictMode> */}
        <PlaybackProvider>
          <AnimatePresence mode='wait' onExitComplete={() => {
            setLoaded("");
            if (!componentHistory.includes(Component.name)) setComponentHistory([...componentHistory, Component.name]);
          }}>
            <Component {...pageProps} key={Component.name} onReady={onReady} />
          </AnimatePresence>
          {!isMobileDevice && <div className={styles.overlay} key="overlay">
            <FloatingPlaybackControls />
          </div>}
        </PlaybackProvider>
      {/* </StrictMode> */}
      <div id="globalLoader" style={(!showLoadingAnim && loadedRoute) ? { opacity: 0, pointerEvents: "none", position: "fixed", transition: "opacity 0.8s 0s cubic-bezier(0.390, 0.575, 0.565, 1.000)" } : { position: "fixed" }}>
        <LoadingAnim className={loaderClass} />
      </div>
    </>
  )
}

MyApp.getInitialProps = async ({ Component, ctx }: { Component: NextComponentType; ctx: NextPageContext }) => {
  let pageProps = {}
  let statusCode = null

  if (Component.getInitialProps) {
    pageProps = await Component.getInitialProps(ctx)
  }

  if (ctx.res) {
    // If `ctx.res` is defined, we're on the server.
    statusCode = ctx.res.statusCode
  } else {
    // If we're on the client, we can fetch the page's status.
    const response = await fetch(window.location.href)
    statusCode = response.status
  }

  return { pageProps, statusCode }
}

export type NextPageWithLayout<P = {}, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode
}

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout,
  statusCode: number
}
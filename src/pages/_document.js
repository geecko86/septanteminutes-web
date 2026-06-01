/* eslint-disable @next/next/google-font-preconnect */
import Document, { Html, Head, Main, NextScript } from "next/document";

class MyDocument extends Document {
  render() {
    return (
      <Html lang="fr">
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="" key="preconnect_fonts_googleapis" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" key="preconnect_fonts_gstatic" />
          <link rel="preconnect" href="https://res.cloudinary.com" crossOrigin="" key="preconnect_cloudinary" />
          <link rel="preconnect" href="https://framerusercontent.com" crossOrigin="" key="preconnect_framerusercontent" />
          <link rel="dns-prefetch" href="https://fonts.googleapis.com" crossOrigin="" key="prefetch_fonts_googleapis" />
          <link rel="dns-prefetch" href="https://fonts.gstatic.com" crossOrigin="" key="prefetch_fonts_gstatic" />
          <link rel="dns-prefetch" href="https://framerusercontent.com" crossOrigin="" key="prefetch_framerusercontent"/>
          <link rel="dns-prefetch" href="https://res.cloudinary.com" crossOrigin="" key="prefetch_cloudinary" />

          <link
            rel="preload"
            href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Inter&family=Futura&family=Oswald:wght@600&family=Jost:wght@400;700;900&display=swap"
            as="style"
          />
          <link
              rel="preload"
              href="https://res.cloudinary.com/dcodwkhcg/raw/upload/v1699617997/fonts/radwave.woff2"
              as="font"
              type="font/woff2" crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="https://fonts.gstatic.com/s/caveat/v18/Wnz6HAc5bAfYB2Q7ZjYYiAzcPA.woff2"
            as="font"
            type="font/woff2" crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="https://res.cloudinary.com/dcodwkhcg/raw/upload/v1780275965/fonts/futura-condensed-extra-bold_ymgni2.woff2"
            as="font"
            type="font/woff2" crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="/img/vinyl_compressed.svg"
            as="image"
            type="image/svg+xml"
          />
          <link
            rel="preload"
            href="/img/SMA_sleeve_256.webp"
            as="image"
            type="image/webp" />
          <link
            rel="preload"
            href="/img/sma_monogram.svg"
            as="image"
            type="image/svg+xml"
          />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;700&family=Inter&family=Futura&family=Oswald:wght@600&family=Jost:wght@400;700;900&display=swap"
          />

          <meta name="google" content="notranslate" />
          <meta name="application-name" content="Septante Minutes Avec" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="default"
          />
          <meta name="apple-mobile-web-app-title" content="Septante Minutes Avec" />
          <meta
            name="description"
            content="Septante Minutes Avec est un podcast belge couvrant des sujets de société."
          />
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta
            name="msapplication-config"
            content="/icons/browserconfig.xml"
          />
          <meta name="msapplication-TileColor" content="#2B5797" />
          <meta name="msapplication-tap-highlight" content="no" />
          <meta name="theme-color" content="#000000" />
          <meta name="color-scheme" content="light" />

          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="apple-touch-icon" sizes="192x192" href="/img/192.png" />
          <link rel="apple-touch-icon" sizes="256x256" href="/img/256.png" />
          <link rel="apple-touch-icon" sizes="512x512" href="/img/512.png" />

          <link rel="manifest" href={`/manifest.json?v=${process.env.BUILD_ID || 0}`} />
          <link rel="mask-icon" href="/img/icon.svg" color="#5bbad5" />
          <link rel="shortcut icon" href="/favicon.ico" />

          <meta name="twitter:creator" content="@GuiHachez" />
          <meta property="og:type" content="website" />

          <meta property="og:image" content="https://res.cloudinary.com/dcodwkhcg/image/upload/v1722887962/avatar.jpg" />
          <meta property="og:image:alt" content="Logo Septante Minutes Avec" />

          <meta name="theme-color" media="(prefers-color-scheme: light)" content="lightgray" />
          <meta name="theme-color" media="(prefers-color-scheme: dark)" content="black" />

          {/* <link rel='apple-touch-startup-image' href='/img/2048.png' sizes='2048x2732' />
          <link rel='apple-touch-startup-image' href='/img/1668.png' sizes='1668x2224' />
          <link rel='apple-touch-startup-image' href='/img/1536.png' sizes='1536x2048' />
          <link rel='apple-touch-startup-image' href='/img/1125.png' sizes='1125x2436' />
          <link rel='apple-touch-startup-image' href='/img/1242.png' sizes='1242x2208' />
          <link rel='apple-touch-startup-image' href='/img/750.png' sizes='750x1334' />
          <link rel='apple-touch-startup-image' href='/img/640.png' sizes='640x1136' /> */}
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;

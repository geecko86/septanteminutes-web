/* eslint-disable @next/next/google-font-preconnect */
/* eslint-disable @next/next/google-font-display */
import Document, { Html, Head, Main, NextScript } from "next/document";

class MyDocument extends Document {
  render() {
    return (
      <Html lang="fr">
        <Head>
          <link rel="stylesheet" href={"/css/orientation.css"} />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link
            rel="preload"
            href="https://fonts.googleapis.com/css2?family=Caveat&display=fallback"
            as="style"
          />
          <link
            rel="preload"
            href="https://fonts.gstatic.com/s/caveat/v18/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9eIipYSxP.woff2"
            as="font"
            type="font/woff2" crossOrigin="anonymous"
          />
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Caveat&display=fallback"
          />

          <meta name="application-name" content="PWA App" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta
            name="apple-mobile-web-app-status-bar-style"
            content="default"
          />
          <meta name="apple-mobile-web-app-title" content="PWA App" />
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

          <link rel="apple-touch-icon" href="/icons/touch-icon-iphone.png" />
          <link rel="apple-touch-icon" sizes="192x192" href="/img/192.png" />
          <link rel="apple-touch-icon" sizes="256x256" href="/img/256.png" />
          <link rel="apple-touch-icon" sizes="512x512" href="/img/512.png" />

          <link rel="manifest" href="/manifest.json" />
          <link rel="mask-icon" href="/img/icon.svg" color="#5bbad5" />
          <link rel="shortcut icon" href="/favicon.ico" />

          <meta
            name="twitter:card"
            content="Podcast belge couvrant des sujets de société"
          />
          <meta name="twitter:url" content="https://www.septanteminutes.be" />
          <meta name="twitter:title" content="Septante Minutes Avec" />
          <meta
            name="twitter:description"
            content="Podcast belge couvrant des sujets de société"
          />
          <meta
            name="twitter:image"
            content="https://www.septanteminutes.be/img/192.png"
          />
          <meta name="twitter:creator" content="@GuiHachez" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="Septante Minutes Avec" />
          <meta
            property="og:description"
            content="Podcast belge couvrant des sujets de société"
          />
          <meta property="og:site_name" content="PWA App" />
          <meta property="og:url" content="https://www.septanteminutes.be" />
          <meta
            property="og:image"
            content="https://www.septanteminutes.be/img/192.png"
          />

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

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import {
  RichText,
  withCSS
} from "framer";
import Image from "next/image";
import Script from "next/script";
import { motion } from "framer-motion";
import * as React from "react";

import styles from "./notebook-open.module.css";

const Component = /*#__PURE__*/ React.forwardRef(function NotebookOpen(
  props,
  ref
) {
  const {
    style,
    className,
    layoutId,
    text: desc,
    ready,
    toggleOverlay,
    title,
    subtitle,
    qSyYbDFAE,
    ...restProps
  } = props;

  return (<motion.div
    className="notebook_open"
    style={{ display: "contents" }}
  >
    <Script id="goToTimestamp">
      {`
        function goToTimestamp(e) {
          const audioElement = window.audioPlayer;
          if (!audioElement) return;

          const timestamp = e.getAttribute("data-timestamp");
          const [hours, minutes, seconds] = timestamp.split(":").map(num => parseInt(num));
          console.log(audioElement, timestamp);
          audioElement.current.currentTime = hours * 3600 + minutes * 60 + seconds;
        }
      `}
    </Script>
    <div {...restProps} className={["notebook_open_contents", className].join(" ")} ready={props.ready ? "true" : "false"} ref={ref} style={{ ...style }} >
      <Image key="image" alt="" fill sizes="(max-width: 1200px) 100vw, 34.5vw" src="https://framerusercontent.com/images/yYJS4WsSdE8HHVqXY7DZVs3GZiM.jpg" />
      <motion.div key="left_page" className="left_page">
        <div key={"split_title"} className="title_subtitle_header">
          <RichText key="episodeTitle" className="title_container" style={{
            "--extracted-gdpscs": "rgb(38, 38, 38)",
            "--framer-link-text-color": "rgb(0, 153, 255)",
            "--framer-link-text-decoration": "underline",
            "--framer-paragraph-spacing": "0px",
          }} verticalAlignment="top" withExternalLayout __fromCanvasComponent id="episodeTitle">
            <h1 style={{
              "--font-selector": "R0Y7Q2F2ZWF0LTcwMA==",
              "--framer-font-family": '"Caveat", sans-serif',
              "--framer-font-size": "30px",
              "--framer-font-weight": "700",
              "--framer-text-color": "var(--extracted-gdpscs, rgb(38, 38, 38))",
            }}>{title}</h1>
          </RichText>
          <RichText key="guestName" className="subtitle_container" style={{
            "--extracted-1eung3n": "rgb(168, 87, 0)",
            "--framer-link-text-color": "rgb(0, 153, 255)",
            "--framer-link-text-decoration": "underline",
            "--framer-paragraph-spacing": "0px",
          }} verticalAlignment="top" withExternalLayout __fromCanvasComponent id="guestName">
            <h2 style={{
              "--font-selector": "R0Y7Q2F2ZWF0LTcwMA==",
              "--framer-font-family": '"Caveat", sans-serif',
              "--framer-font-size": "14px",
              "--framer-font-weight": "700",
              "--framer-text-color": "var(--extracted-1eung3n, rgb(168, 87, 0))",
            }}>{subtitle}</h2>
          </RichText>
        </div>
        <RichText key="scrollTarget" className={`${styles.scrollTarget} scroll_description`} style={{
          "--extracted-r6o4lv": "rgb(38, 38, 38)",
          "--framer-link-text-color": "rgb(0, 153, 255)",
          "--framer-link-text-decoration": "underline",
          "--framer-paragraph-spacing": "0px",
        }} verticalAlignment="top" withExternalLayout __fromCanvasComponent id="scrollTarget">
            <p style={{
              "--font-selector": "R0Y7Q2F2ZWF0LXJlZ3VsYXI=",
              "--framer-font-family": '"Caveat", sans-serif',
              "--framer-font-size": "17px",
              "--framer-line-height": "1em",
              "--framer-text-color": "var(--extracted-r6o4lv, rgb(38, 38, 38))",
            }} dangerouslySetInnerHTML={{ __html: desc.replace(/\b(\d{2}:\d{2}:\d{2})\b/g, "<span onClick=\"goToTimestamp(this)\" data-timestamp=\"$1\">$1</span>").replace("<a ", "<a target=\"_blank\" ") }} />
        </RichText>
      </motion.div>
      <RichText key="SubscribeCallToAction" className="subscribe_header" data-framer-component-type="RichTextContainer"
        style={{
          "--extracted-r6o4lv": "rgb(38, 38, 38)",
          "--framer-link-text-color": "rgb(0, 153, 255)",
          "--framer-link-text-decoration": "underline",
          "--framer-paragraph-spacing": "0px",
        }} verticalAlignment="top">
          <h3 key="followPrompt" className={styles.subscribe} style={{
            "--font-selector": "R0Y7Q2F2ZWF0LXJlZ3VsYXI=",
            "--framer-font-family": '"Caveat", sans-serif',
            "--framer-font-size": "17px",
            "--framer-text-color": "var(--extracted-r6o4lv, rgb(38, 38, 38))",
          }}>
            Abonnez-vous !
          </h3>
      </RichText>
      <div className={[styles.exit_cross, styles.exit_cross_2].join(" ")}
        key="exit_cross"
        onClick={() => { if (props.toggleOverlay) props.toggleOverlay(false); }}
      />
      <div key="stamps" className="stamps">
        {[
          { key: "apple-podcasts-stamp", className: styles.apple_stamp, href: "https://podcasts.apple.com/be/podcast/septante-minutes-avec/id1435036591" },
          { key: "rss-stamp", className: styles.rss_stamp, href: "https://anchor.fm/s/b43f59a8/podcast/rss" },
          { key: "spotify-stamp", className: styles.spotify_stamp, href: "https://open.spotify.com/show/1e5Wx2MUdGQNZupixNZw3r" },
          { key: "pocket-casts-stamp", className: styles.pocketcasts_stamp, href: "https://pca.st/A6sJ" },
          { key: "youtube-stamp", className: styles.youtube_stamp, href: "https://www.youtube.com/@SeptanteMinutes" },
          { key: "facebook-stamp", className: styles.facebook_stamp, href: "https://www.facebook.com/SeptanteMinutesAvec" },
          { key: "twitter-stamp", className: styles.twitter_stamp, href: "https://twitter.com/SeptanteMinutes" },
          { key: "instagram-stamp", className: styles.instagram_stamp, href: "https://www.instagram.com/SeptanteMinutes" },
          { key: "tiktok-stamp", className: styles.tiktok_stamp, href: "https://tiktok.com/@guihachez" },
        ].map(({ key, className, href }) => (
          <a target="_blank" key={key} className={`stamp ${className} ${styles.stamp}`}
            href={href} aria-label={"Lien " + key.replace("-", " ").replace("stamp", "").trim()}
            style={{
              filter: "drop-shadow(0px 1px 0px rgba(0, 0, 0, 0.12))",
              rotate: 0,
            }}>
            <motion.div className={styles.stamp_inner_shadow} />
            <motion.div className={styles.stamp_paper} />
            <motion.div className={styles.stamp_logo} />
          </a>
        ))}
      </div>
    </div>
  </motion.div>);
});

const css = [
  '.notebook_open [data-border="true"]::after { content: ""; border-width: var(--border-top-width, 0) var(--border-right-width, 0) var(--border-bottom-width, 0) var(--border-left-width, 0); border-color: var(--border-color, none); border-style: var(--border-style, none); width: 100%; height: 100%; position: absolute; box-sizing: border-box; left: 0; top: 0; border-radius: inherit; pointer-events: none; }',
  "@supports (aspect-ratio: 1) { body { --framer-aspect-ratio-supported: auto; } }",
  ".notebook_open .stamp { display: block; }",
  ".notebook_open .notebook_open_contents { height: 533px; position: relative; width: 725px; }",
  ".notebook_open .left_page { align-content: center; align-items: center; display: flex; flex: none; flex-direction: column; flex-wrap: nowrap; gap: 16px; height: min-content; justify-content: center; left: 42px; padding: 0px 0px 0px 0px; position: absolute; top: 49px; width: 297px; }",
  ".notebook_open .title_subtitle_header { align-content: center; align-items: center; display: flex; flex: none; flex-direction: column; flex-wrap: nowrap; gap: 4px; height: min-content; justify-content: center; padding: 0px 0px 0px 0px; position: relative; width: 297px; }",
  ".notebook_open .title_container, .notebook_open .subtitle_container, .notebook_open .scroll_description { flex: none; height: auto; position: relative; white-space: pre-wrap; width: 100%; word-break: break-word; word-wrap: break-word; }",
  ".notebook_open .subscribe_header { flex: none; height: auto; position: absolute; right: 100px; top: 49px; white-space: pre-wrap; width: 211px; word-break: break-word; word-wrap: break-word; }",
  ".notebook_open .stamps { flex: none; height: 208px; position: absolute; right: 44px; top: 93px; width: 280px; }",
  "@supports (background: -webkit-named-image(i)) and (not (font-palette:dark)) { .notebook_open .left_page, .notebook_open .title_subtitle_header { gap: 0px; } .notebook_open .left_page > * { margin: 0px; margin-bottom: calc(16px / 2); margin-top: calc(16px / 2); } .notebook_open .left_page > :first-child, .notebook_open .title_subtitle_header > :first-child { margin-top: 0px; } .notebook_open .left_page > :last-child, .notebook_open .title_subtitle_header > :last-child { margin-bottom: 0px; } .notebook_open .title_subtitle_header > * { margin: 0px; margin-bottom: calc(4px / 2); margin-top: calc(4px / 2); } }",
];

const NotebookOpen = withCSS(Component, css, "notebook_open");

NotebookOpen.displayName = "NoteBook-Open";
export default NotebookOpen;
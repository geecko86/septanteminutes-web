import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Image from "next/image";
import Script from "next/script";
import { motion } from "framer-motion";
import * as React from "react";

import styles from "./notebook-open.module.css";

const NotebookOpen = React.forwardRef(function NotebookOpen(
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
    date,
    title,
    subtitle,
    qSyYbDFAE,
    ...restProps
  } = props;

  const pubDate = new Date(date);
  const displayedDate = (pubDate.getUTCFullYear() != new Date().getUTCFullYear()) ?
    pubDate.toLocaleDateString("fr-BE") :
    pubDate.toLocaleDateString("fr-BE", { month: "long", day: "numeric" });
  
  return (<motion.div
    className={styles.notebook_open}
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
    <div {...restProps} className={[styles.notebook_open_contents, className].join(" ")} ready={props.ready ? "true" : "false"} ref={ref} style={{ ...style }} >
      <Image key="image" alt="" fill sizes="(max-width: 1200px) 100vw, 34.5vw" src="https://framerusercontent.com/images/yYJS4WsSdE8HHVqXY7DZVs3GZiM.jpg" />
      <motion.div key="left_page" className={styles.left_page}>
        <div key={"split_title"} className={styles.title_subtitle_header}>
          <h1 className={styles.title_container} data-framer-component-type="RichTextContainer" verticalAlignment="top" style={{
            fontFamily: '"Caveat", sans-serif',
            fontSize: "1.9rem",
            "--framer-font-weight": "700",
            color: "var(--extracted-gdpscs, rgb(38, 38, 38))",
          }}>{title}</h1>
          <h2 className={styles.subtitle_container} data-framer-component-type="RichTextContainer" style={{
            fontFamily: '"Caveat", sans-serif',
            fontSize: "0.875rem",
            "--framer-font-weight": "700",
            color: "var(--extracted-1eung3n, rgb(168, 87, 0))",
          }} verticalAlignment="top" id="guestName">{subtitle}</h2>
          <h4 className={styles.date_container} data-framer-component-type="RichTextContainer" style={{
            fontFamily: '"Caveat", sans-serif',
            fontSize: "2.3svh",
            lineHeight: "2.3svh",
            position: "relative",
            margin: "0px",
            alignSelf: "center",
            "--framer-font-weight": "700",
            color: "var(--extracted-1eung3n, rgb(90, 90, 90))",
          }} verticalAlignment="top" id="episode_date">{displayedDate}</h4>
        </div>
        <p vdata-framer-component-type="RichTextContainer" className={`${styles.scrollTarget} ${styles.scroll_description}`} style={{
          fontFamily: '"Caveat", sans-serif',
          fontSize: "1.06rem",
          "--framer-line-height": "1.285em",
          color: "var(--extracted-r6o4lv, rgb(38, 38, 38))",
        }} id="scrollTarget" verticalAlignment="top" dangerouslySetInnerHTML={{ __html: desc.replace(/\b(\d{2}:\d{2}:\d{2})\b/g, "<span onClick=\"goToTimestamp(this)\" data-timestamp=\"$1\">$1</span>").replace("<a ", "<a target=\"_blank\" ") }} />
      </motion.div>
      <h3 key="followPrompt" className={[styles.subscribe, styles.subscribe_header].join(" ")} style={{
        fontFamily: '"Caveat", sans-serif',
        fontSize: "1.06rem",
        "--framer-font-weight": "400",
        color: "var(--extracted-r6o4lv, rgb(38, 38, 38))",
      }} data-framer-component-type="RichTextContainer" verticalAlignment="top">
        Abonnez-vous !
      </h3>
      <div className={[styles.exit_cross, styles.exit_cross_2].join(" ")}
        key="exit_cross"
        onClick={() => { if (props.toggleOverlay) props.toggleOverlay(false); }}
      />
      <div className={[styles.exit_cross].join(" ")}
        key="exit_cross"
        onClick={() => { if (props.toggleOverlay) props.toggleOverlay(false); }}
      />
      <div key="stamps" className={styles.stamps}>
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

NotebookOpen.displayName = "NoteBook-Open";
export default NotebookOpen;
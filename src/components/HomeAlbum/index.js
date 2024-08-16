import Image from "next/image";
import React, { useState, useRef, useMemo } from 'react';
import { motion } from "framer-motion";
import Link from "next/link";

import styles from "./homealbum.module.css";
import { isMobile } from "react-device-detect";

const HomeAlbumComponent = ({ height, id, image, num, guest, width, onClick, ...otherProps }) => {
  const [isHovered, setHovered] = useState(false);
  const { style, className, variant, l4skPfBuN, onReady, imageRef, ...rest } = otherProps;

  const [subject, guestName] = useMemo(() => {
    const parts = guest.split(/\s(-|–)\s?/g);
    return [parts[2], parts[0]];
  }, [guest]);

  const newLine = guestName.length < 22;

  const T = useRef(null);

  return (
    <Link
      initial={variant}
      className={`framer-LFfFl ${className || ""}`}
      scroll={false} id={id} href={`/${num}`}
      onClick={onClick}
    >
      <motion.div
        className={styles.boxart}
        onHoverStart={() => setHovered(!isMobile)}
        onHoverEnd={() => setHovered(false)}
        transition={{ type: "spring", stiffness: 100, damping: 15, mass: 1 }}
        style={{
          height: "auto",
          width: "100%",
          aspectRatio: 1,
          translateZ: "0px"
        }}
        initial={{ opacity: 0.95, translateY: "-0%" }}
        animate={{ opacity: isHovered ? 1.0 : 0.95, translateY: isHovered ? "-10%" : "-0%" }}
      >
        {image && (
          <Image draggable="false"
            src={image}
            ref={imageRef}
            fill={true}
            sizes="(orientation: portrait) 20vh, 15vw"
            quality={80}
            className={styles.homeAlbum_img}
            loading="eager"
            placeholder="blur"
            blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/+EAjEV4aWYAAE1NACoAAAAIAAGHaQAEAAAAAQAAABoAAAAAAASShgAHAAAAMwAAAFCgAQADAAAAAQABAACgAgAEAAAAAQAABLCgAwAEAAAAAQAABLAAAAAAQVNDSUkAAAAxLjczLjAtMjNPLTVCUk80UldQNDZQM1M0QkNSQjY2SlhRTDNBLjAuMi02AP/bAEMAAgEBAgEBAgICAgICAgIDBQMDAwMDBgQEAwUHBgcHBwYHBwgJCwkICAoIBwcKDQoKCwwMDAwHCQ4PDQwOCwwMDP/bAEMBAgICAwMDBgMDBgwIBwgMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDP/AABEIAAoACgMBIgACEQEDEQH/xAAXAAADAQAAAAAAAAAAAAAAAAACBAkK/8QAJxAAAgECBAUFAQAAAAAAAAAAAQIDBCEABQYRBwgJEjEUQUVRUmL/xAAUAQEAAAAAAAAAAAAAAAAAAAAF/8QAHREAAQIHAAAAAAAAAAAAAAAAAQAEAhJCU5Ki4v/aAAwDAQACEQMRAD8AnFmnSo4+JVS1EeXok0Ufp6gTV4jkUe4FrpYXO3jB0/Sa5gqqBJU01JMkihlkSd2WQEb9wIW4P3jQnUcvHD+XJ5XbQ2jmeWsad2OS0xLyWPeT2Xbe+/nDuS8DNEjJ6QDR2lgBCnxMH5H8YILl6K4cektO1tbFf//Z"
            alt=""
            style={{
              borderBottomLeftRadius: 2,
              borderBottomRightRadius: 2,
              borderTopLeftRadius: 2,
              borderTopRightRadius: 2,
              left: 0,
              top: 0,
              boxShadow:
                "0px 3px 2px 0px rgba(0, 0, 0, 0.10000000149011612), 0px 4px 8px 0px rgba(0, 0, 0, 0.05000000074505806)",
            }}
          />
        )}
      </motion.div>
      <div className={styles.album_support} />
      <p
        style={{
          position: "absolute",
        }}
      >
        <span>{`${guestName}${newLine ? "\n" : " "}`}</span><span>{`${subject}`}</span>
      </p>
    </Link>
  );
}

const HomeAlbum = React.memo(HomeAlbumComponent);
HomeAlbum.displayName = 'HomeAlbum';

export default HomeAlbum;
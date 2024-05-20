import React, { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

export default React.forwardRef((props, ref) => {
  const [hovered, setHovered] = useState(false);
  
  return (
    <motion.div
      {...props}
      ref={ref}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      transition={{ damping: 60, delay: 0, mass: 1, stiffness: 500, type: "spring" }}
      animate={{
        rotate: !hovered ? 0 : -3
      }}
      style={{
        ...(props.style),
        position: "relative",
        overflow: "clip"
      }}
    >
      <Image
        src="https://framerusercontent.com/images/zLZpVcFd3TJlKbssFNQWljSjDo.png"
        alt="notebook"
        style={{
          position: "absolute",
          inset: 0,
          color: "transparent"
        }}
        fill={true}
      />
      <div
        style={{
          pointerEvents: "none",
          height: "32%",
          left: "28.45%",
          overflow: "clip",
          position: "absolute",
          top: "36.6938%",
          width: "32%"
        }}
      >
        <p
          style={{
            "--font-selector": "R0Y7Q2F2ZWF0LTcwMA==",
            color: "var(--extracted-r6o4lv, rgb(38, 38, 38))",
            letterSpacing: "-0.8px",
            lineHeight: "var(--framer-line-height, 1.2em)",
            fontFamily: "\"Caveat\", sans-serif",
            fontWeight: 700
          }}
        >
          Description
        </p>
      </div>
    </motion.div>
  );
});
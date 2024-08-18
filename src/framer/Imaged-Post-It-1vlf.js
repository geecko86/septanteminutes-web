import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import React from "react";
import Head from "next/head";
const enabledGestures = { aP1r6qEU4: { hover: true } };
const cycleOrder = ["aP1r6qEU4"];
const variantClassNames = { aP1r6qEU4: "framer-v-tgvrn3" };
const transitions = {
  default: { damping: 60, delay: 0, mass: 1, stiffness: 500, type: "spring" },
};
const toResponsiveImage = (value) => {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof value.src === "string"
  ) {
    return value;
  }
  return typeof value === "string" ? { src: value } : undefined;
};

const css = [
  '.framer-C4Wjh [data-border="true"]::after { content: ""; border-width: var(--border-top-width, 0) var(--border-right-width, 0) var(--border-bottom-width, 0) var(--border-left-width, 0); border-color: var(--border-color, none); border-style: var(--border-style, none); width: 100%; height: 100%; position: absolute; box-sizing: border-box; left: 0; top: 0; border-radius: inherit; pointer-events: none; }',
  "@supports (aspect-ratio: 1) { body { --framer-aspect-ratio-supported: auto; } }",
  ".framer-C4Wjh { /* display: contents; */ }",
  ".framer-C4Wjh .framer-14uv52q { display: block; }",
  ".framer-C4Wjh .framer-tgvrn3 { height: 140px; overflow: clip; position: relative !important; width: 140px; }",
  ".framer-C4Wjh .framer-1tcxbxb { aspect-ratio: 1 / 1; bottom: 0px; flex: none; height: 100%; left: 0px; position: absolute; width: var(--framer-aspect-ratio-supported, 140px); }",
  ".framer-C4Wjh .framer-d1mgg1 { flex: none; height: auto; left: 50%; position: absolute; top: 38px; white-space: pre; width: auto; }",
  ".framer-C4Wjh .framer-v-tgvrn3 .framer-tgvrn3 { cursor: pointer; }",
];

const getProps = ({ height, id, image, link, onClick, separate, logo, title, width, ...props }) => {
  var ref2;
  return {
    onClick,
    ...props,
    link: link,
    separate: separate,
    XmvAL8ZsJ:
      (ref2 = image !== null && image !== void 0 ? image : props.XmvAL8ZsJ) !==
        null && ref2 !== void 0
        ? ref2
        : {
          src: new URL(
            "https://framerusercontent.com/assets/LrAyLk4UQNWCrqITOzynthhRv0U.webp",
          ).href,
        },
  };
};
const Component = /*#__PURE__*/ React.forwardRef(function ImagedPostIt(
  props,
  ref
) {
  const {
    style,
    className,
    layoutId,
    variant,
    XmvAL8ZsJ,
    dkre4FA5N,
    fKpdeXn5p,
    src,
    link,
    separate,
    onClick,
    ...restProps
  } = getProps(props);

  const [hovered, setHovered] = React.useState(false);

  return (
    <>
      <Head>
        <style>{css.join("")}</style>
      </Head>
      <div>
        <motion.div
          style={{
            display: "contents",
          }}
          className="framer-C4Wjh"
          onHoverStart={() => setHovered(true)}
          onHoverEnd={() => setHovered(false)}
        >
          <motion.div
            className={["framer-tgvrn3", "framer-1tcxbxb", className].join(" ")}
            {...restProps}
            animate={{ rotate: hovered ? 4 : 0, cursor: "pointer", ...style }}
            transition={transitions.default}
            ref={ref}
            tabIndex="0"
            onClick={onClick}
          >
            <Image key="img_postitIMG" alt="" fill sizes="10vmax" {...toResponsiveImage(XmvAL8ZsJ)} />
            <Link
              href={link || "#"} style={{ width: "100%", height: "100%" }}
              scroll={false} target={separate ? "_blank" : ""}>
              <div key="call-to-action_postitIMG" className="framer-d1mgg1" data-framer-component-type="RichTextContainer"
              style={{
                "--framer-link-text-color": "rgb(0, 153, 255)",
                "--framer-link-text-decoration": "underline",
                "--framer-paragraph-spacing": "0px",
                x: "-50%",
              }}>
                <p className="framer-styles-preset-1sry874" data-styles-preset="aJJBLE7Pu">{props.title}</p>
              </div>
              { /* eslint-disable-next-line */}
              <img draggable="false" key="logo_postitIMG"
                alt=""
                src={src}
                style={{
                  borderBottomLeftRadius: 2,
                  borderBottomRightRadius: 2,
                  borderTopLeftRadius: 2,
                  borderTopRightRadius: 2,
                  rotate: 180,
                }} />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </>)
});

Component.displayName = "Imaged Post It";
Component.defaultProps = { height: 140, width: 140 };
export default Component;
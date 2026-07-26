;

import styles from "./overlay.module.css";
import { enterAnim, exitAnim } from "../../anim/notebook.js";
import {
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  FloatingNode,
  FloatingPortal,
  FloatingOverlay,
} from "@floating-ui/react";
import React, { useState } from "react";
import { motion, animate, AnimatePresence } from "framer-motion";

import NoteBookOpen from "../../framer/NoteBook-Open-NHDl.js";

const NotebookOverlay = ({ title = "", subtitle = "", desc = "", date = "", translateX = "left" }) => {
  const [descVisible, setdescVisible] = useState(false);
  const [ready, setReady] = useState(false);

  const toggleOverlay = (open) => {
    if (open) {
      // setFloatingNode(true);
      let target = document.getElementById("scrollTarget");
      if (target) target.scrollTop = 0;
    }
    setdescVisible(open);
  };

  const { refs, context } = useFloating({
    open: descVisible,
    onOpenChange: (open) => {
      toggleOverlay(open);
    },
  });

  const dismiss = useDismiss(context);
  const click = useClick(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
  ]);

  const component = (
    <FloatingNode id="notebook_overlay">
      <FloatingPortal>
        <AnimatePresence>
          <motion.div
            initial="close"
            exit="close"
            variants={{
              open: {
                opacity: 1,
                transition: { duration: 0.3, ease: [0.5, 0, 0.88, 0.77] },
              },
              close: {
                opacity: 0,
                transition: { duration: 0.45, ease: [0.12, 0.23, 0.5, 1] },
              },
            }}
            animate={descVisible ? "open" : "close"}
            onAnimationStart={() => {
              animate(descVisible ? enterAnim : exitAnim, {
                duration: descVisible ? 0.4 : 0.4,
              });
              if (!descVisible) setReady(false);

              if (descVisible) {
                let scrollableDiv = document.getElementById('scrollTarget');
                scrollableDiv.scrollTop = Math.min(scrollableDiv.scrollHeight, scrollableDiv.clientHeight);
                setTimeout(() => {
                    // Animate the scroll back up
                    scrollableDiv.scrollTo({
                        top: 0,
                        behavior: 'smooth'
                    });
                }, 200);
              }
            }}
            onAnimationComplete={() => {
              if (descVisible) setReady(true);
            }}
            {...getFloatingProps()}
          >
            <FloatingOverlay
              lockScroll
              // The open notebook is a purely VISUAL rendition: its content
              // (title, description, subscribe links) duplicates the episode
              // sheet exposed in the page sections. Keep it out of the
              // accessibility tree — otherwise screen readers announce the
              // whole description twice (and this pre-rendered overlay leaks
              // into the tree even while closed).
              aria-hidden="true"
              className={[styles.backdrop, descVisible ? "" : styles.hidden].join(" ")}
              onClick={(e) => {
                if (!refs.floating.current?.contains(e.target)) {
                  toggleOverlay(false);
                }
              }}
            >
              <NoteBookOpen
                role="dialog"
                aria-label={`${title}, ${subtitle}`}
                ref={refs.setFloating}
                className={[styles.openbook, styles[`page_${translateX}`]].join(" ")}
                followPrompt={"Abonnez-vous !"}
                title={title}
                subtitle={subtitle}
                text={desc}
                date={date}
                ready={ready}
                toggleOverlay={toggleOverlay}
                onClick={() => {}}
              />
            </FloatingOverlay>
          </motion.div>
        </AnimatePresence>
      </FloatingPortal>
    </FloatingNode>
  );

  return {
    notebookOverlayComponent: component,
    referenceProps: getReferenceProps(),
    refs,
  };
};

export default NotebookOverlay;

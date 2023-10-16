"use client";

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

const NotebookOverlay = ({ setFloatingNode }) => {
  const [descVisible, setdescVisible] = useState(false);

  const toggleOverlay = (open) => {
    if (open) {
      setFloatingNode(true);
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
            }}
            onAnimationComplete={() => {
              if (!descVisible) setFloatingNode(false);
            }}
            {...getFloatingProps()}
          >
            <FloatingOverlay
              lockScroll
              className={[styles.backdrop, descVisible ? "" : styles.hidden].join(" ")}
              onClick={(e) => {
                if (!refs.floating.current?.contains(e.target)) {
                  toggleOverlay(false);
                }
              }}
            >
              <NoteBookOpen
                role="dialog"
                ref={refs.setFloating}
                className={styles.openbook}
                followPrompt={"Abonnez-vous !"}
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

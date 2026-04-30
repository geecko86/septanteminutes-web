// @vitest-environment jsdom
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './index.module.css';

type MobileServiceSheetProps = {
  open: boolean;
  onDismiss: () => void;
  header?: React.ReactNode;
  children: React.ReactNode;
};

export default function MobileServiceSheet({ open, onDismiss, header, children }: MobileServiceSheetProps) {
  // Lock the page scroll while the sheet is open so the background
  // doesn't scroll underneath the overlay.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Allow the user to dismiss the sheet by pressing Escape — same
  // behaviour as a modal dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onDismiss]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Semi-transparent backdrop — clicking it dismisses the sheet */}
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onDismiss}
          />
          {/* The sheet itself slides up from the bottom with a spring feel.
              The user can also drag it downward past 100 px or flick it
              quickly (velocity > 500) to dismiss it. */}
          <motion.div
            className={styles.sheet}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onDismiss();
            }}
          >
            {header && <div className={styles.header}>{header}</div>}
            <div className={styles.body}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

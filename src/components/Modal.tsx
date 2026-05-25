"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible label for the dialog. */
  ariaLabel?: string;
  children: React.ReactNode;
}

/**
 * Lightweight modal:
 *  - Renders to document.body via a portal so backdrop-blur covers the
 *    whole dashboard regardless of the trigger's stacking context.
 *  - Dark overlay + backdrop-blur for the page behind.
 *  - Click outside or press Escape to close.
 *  - Locks body scroll while open.
 */
export default function Modal({
  open,
  onClose,
  ariaLabel,
  children,
}: ModalProps) {
  // Esc to close + scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Portal target only exists on the client.
  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          onMouseDown={(e) => {
            // Only close when the click started AND ended on the backdrop.
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-zinc-950/55 backdrop-blur-md" />

          {/* Dialog surface */}
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-2xl bg-zinc-950 text-zinc-100 rounded-2xl border border-zinc-800/80 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] overflow-hidden max-h-[calc(100vh-2rem)] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Subtle gradient accent — keeps the slab from feeling flat. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.18] bg-[radial-gradient(circle_at_0%_0%,rgba(249,115,22,0.45),transparent_55%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,0.18),transparent_55%)]"
            />
            <div className="relative flex flex-col min-h-0">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

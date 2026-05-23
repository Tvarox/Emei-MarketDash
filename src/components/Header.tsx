"use client";

import { motion, AnimatePresence } from "framer-motion";

interface HeaderProps {
  block: number;
  blockProgress: number;
}

export default function Header({ block, blockProgress }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-zinc-200/60">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg shadow-orange-500/25 flex items-center justify-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-tight text-zinc-900">
            EMEI
          </span>
        </div>

        {/* Network Pill */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative flex items-center gap-2.5 bg-white border border-zinc-200/80 rounded-full pl-3 pr-4 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_16px_-2px_rgba(0,0,0,0.06)] overflow-hidden"
        >
          {/* Block progress bar at the bottom of the pill */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-100">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-[width] duration-100 ease-linear"
              style={{ width: `${blockProgress * 100}%` }}
            />
          </div>

          <div className="relative flex items-center justify-center">
            <motion.span
              className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500"
              animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="relative w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          </div>
          <span className="text-xs font-semibold text-zinc-700">
            Mantle Sepolia
          </span>
          <span className="w-px h-3 bg-zinc-200" />
          <div className="text-xs font-medium text-zinc-500 font-[family-name:var(--font-jetbrains)] flex items-center gap-1">
            <span>Block</span>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={block}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="text-zinc-900 font-semibold inline-block min-w-[20px] text-left"
              >
                {block}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </header>
  );
}

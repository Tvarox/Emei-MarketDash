"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 bg-zinc-950 backdrop-blur-xl border-b border-zinc-950">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <Image
            src="/Logo.svg"
            alt=""
            width={22}
            height={22}
            className="w-[22px] h-[22px] invert"
            priority
          />
          <span className="text-xl font-bold tracking-tight text-white">
            EMEI
          </span>
        </div>

        {/* Network Pill */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative flex items-center gap-2.5 bg-zinc-900 border border-zinc-700/80 rounded-full pl-3 pr-4 py-1.5 shadow-[0_1px_3px_rgba(0,0,0,0.2),0_4px_16px_-2px_rgba(0,0,0,0.3)] overflow-hidden"
        >
          <div className="relative flex items-center justify-center">
            <motion.span
              className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500"
              animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
            />
            <span className="relative w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
          </div>
          <span className="text-xs font-semibold text-zinc-300">
            Mantle Sepolia
          </span>
        </motion.div>
      </div>
    </header>
  );
}

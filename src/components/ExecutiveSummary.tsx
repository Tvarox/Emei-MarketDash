"use client";

import { motion } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";
import { shortHash } from "@/lib/api";

interface ExecutiveSummaryProps {
  tvl: number;
  volumeSettled: number;
  paid: number;
  issued: number;
  presented: number;
  overdue: number;
  receiptsAnchored?: number;
  latestReceiptRoot?: string | null;
}

export default function ExecutiveSummary({
  tvl,
  // volumeSettled,
  paid,
  issued,
  overdue,
  receiptsAnchored = 0,
  latestReceiptRoot = null,
}: ExecutiveSummaryProps) {
  const successRate = issued > 0 ? Math.round((paid / issued) * 100) : 0;

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:flex lg:flex-col">
      <MetricCard
        label="Protocol TVL"
        value={tvl}
        unit="mUSD"
        delta="Self-custodial vault"
        deltaPositive
        delay={0}
      />
      {/*
      <MetricCard
        label="Volume Settled"
        value={volumeSettled}
        unit="mUSD"
        delta={`${paid} invoices paid`}
        deltaPositive
        delay={0.06}
      />
      */}
      <ReceiptsCard
        receipts={receiptsAnchored}
        latestRoot={latestReceiptRoot}
        delay={0.12}
      />
      <SuccessRateCard
        paid={paid}
        issued={issued}
        overdue={overdue}
        successRate={successRate}
        delay={0.18}
      />
    </section>
  );
}

function MetricCard({
  label,
  value,
  unit,
  delta,
  deltaPositive,
  delay,
}: {
  label: string;
  value: number;
  unit: string;
  delta: string;
  deltaPositive: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)] transition-shadow flex-1 min-h-[164px]"
    >

      <div className="relative h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
              {label}
            </p>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
          </div>
          <div className="mt-3.5 flex items-baseline gap-1.5">
            <AnimatedNumber
              value={value}
              decimals={2}
              duration={800}
              className="text-2xl font-bold tracking-tight text-zinc-900 font-[family-name:var(--font-jetbrains)] tabular-nums"
            />
            <span className="text-sm font-semibold text-zinc-500">{unit}</span>
          </div>
        </div>
        <div className="mt-auto pt-4 flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
              deltaPositive ? "text-emerald-600" : "text-red-500"
            }`}
          >
            {deltaPositive ? "▲" : "▼"} {delta}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

function ReceiptsCard({
  receipts,
  latestRoot,
  delay,
}: {
  receipts: number;
  latestRoot: string | null;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)] transition-shadow flex-1 min-h-[164px]"
    >

      <div className="relative h-full flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
              Cryptographic Receipts
            </p>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/85 rounded-full px-1.5 py-0.5">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              ANCHORED
            </span>
          </div>
          <div className="mt-3.5 flex items-baseline gap-1.5">
            <AnimatedNumber
              value={receipts}
              decimals={0}
              duration={800}
              className="text-2xl font-bold tracking-tight text-zinc-900 font-[family-name:var(--font-jetbrains)] tabular-nums"
            />
            <span className="text-sm font-semibold text-zinc-500">on-chain</span>
          </div>
        </div>
        <div className="mt-auto pt-4">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
            Latest Merkle Root
          </p>
          <p
            title={latestRoot ?? undefined}
            className="text-[11px] font-[family-name:var(--font-jetbrains)] text-zinc-800 truncate tabular-nums font-semibold"
          >
            {shortHash(latestRoot, 10, 6)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

function SuccessRateCard({
  paid,
  issued,
  overdue,
  successRate,
  delay,
}: {
  paid: number;
  issued: number;
  overdue: number;
  successRate: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)] transition-shadow flex-1 min-h-[164px]"
    >

      <div className="relative h-full flex flex-col justify-between">
        <div>
          <div className="flex items-start justify-between">
            <p className="text-[11px] font-bold text-zinc-800 uppercase tracking-wider">
              Invoice Success Rate
            </p>
            <motion.span
              key={successRate}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              className="text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200/85 rounded-full px-2 py-0.5 tabular-nums"
            >
              {successRate}%
            </motion.span>
          </div>
          <div className="mt-3.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-zinc-900 font-[family-name:var(--font-jetbrains)] tabular-nums">
              {paid}
            </span>
            <span className="text-base font-semibold text-zinc-500 font-[family-name:var(--font-jetbrains)] tabular-nums">
              / {issued}
            </span>
            <span className="text-sm font-semibold text-zinc-500 ml-1">Paid</span>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <div className="h-1.5 bg-zinc-200/80 rounded-full overflow-hidden relative">
            <motion.div
              animate={{ width: `${successRate}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.4)]"
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10px] font-semibold text-zinc-600">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${overdue > 0 ? "bg-red-500" : "bg-orange-500"}`} />
              <span className={overdue > 0 ? "text-red-600 font-bold" : ""}>
                {overdue} overdue
              </span>
            </span>
            <span className="font-[family-name:var(--font-jetbrains)] tabular-nums text-zinc-500">
              {issued} total
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

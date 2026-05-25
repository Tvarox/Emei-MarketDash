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
  receiptsAnchored?: number;
  latestReceiptRoot?: string | null;
}

export default function ExecutiveSummary({
  tvl,
  volumeSettled,
  paid,
  issued,
  receiptsAnchored = 0,
  latestReceiptRoot = null,
}: ExecutiveSummaryProps) {
  const successRate = issued > 0 ? Math.round((paid / issued) * 100) : 0;

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Protocol TVL"
        value={tvl}
        unit="mUSD"
        delta="Self-custodial vault"
        deltaPositive
        delay={0}
      />
      <MetricCard
        label="Volume Settled"
        value={volumeSettled}
        unit="mUSD"
        delta={`${paid} invoices paid`}
        deltaPositive
        delay={0.06}
      />
      <ReceiptsCard
        receipts={receiptsAnchored}
        latestRoot={latestReceiptRoot}
        delay={0.12}
      />
      <SuccessRateCard
        paid={paid}
        issued={issued}
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
      className="group relative overflow-hidden bg-white rounded-2xl border border-zinc-200/70 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)] transition-shadow"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-zinc-50/50 pointer-events-none" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            {label}
          </p>
          <span className="flex items-center gap-1 text-[10px] font-medium text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            LIVE
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <AnimatedNumber
            value={value}
            decimals={2}
            duration={800}
            className="text-3xl font-bold tracking-tight text-zinc-900 font-[family-name:var(--font-jetbrains)] tabular-nums"
          />
          <span className="text-sm font-semibold text-zinc-400">{unit}</span>
        </div>
        <div className="mt-3 flex items-center gap-1.5">
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
      className="relative overflow-hidden bg-white rounded-2xl border border-zinc-200/70 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)] transition-shadow"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-emerald-50/40 pointer-events-none" />

      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Cryptographic Receipts
          </p>
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 border border-emerald-200/80 rounded-full px-1.5 py-0.5">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ANCHORED
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <AnimatedNumber
            value={receipts}
            decimals={0}
            duration={800}
            className="text-3xl font-bold tracking-tight text-zinc-900 font-[family-name:var(--font-jetbrains)] tabular-nums"
          />
          <span className="text-sm font-semibold text-zinc-400">on-chain</span>
        </div>
        <div className="mt-3">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Latest Merkle Root
          </p>
          <p
            title={latestRoot ?? undefined}
            className="text-[11px] font-[family-name:var(--font-jetbrains)] text-zinc-700 truncate tabular-nums"
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
  successRate,
  delay,
}: {
  paid: number;
  issued: number;
  successRate: number;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden bg-white rounded-2xl border border-zinc-200/70 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)] transition-shadow"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white via-white to-orange-50/30 pointer-events-none" />

      <div className="relative">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Invoice Success Rate
          </p>
          <motion.span
            key={successRate}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className="text-[11px] font-bold text-orange-600 bg-orange-50 border border-orange-200/80 rounded-full px-2 py-0.5 tabular-nums"
          >
            {successRate}%
          </motion.span>
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tracking-tight text-zinc-900 font-[family-name:var(--font-jetbrains)] tabular-nums">
            {paid}
          </span>
          <span className="text-lg font-semibold text-zinc-400 font-[family-name:var(--font-jetbrains)] tabular-nums">
            / {issued}
          </span>
          <span className="text-sm font-semibold text-zinc-400">Paid</span>
        </div>

        <div className="mt-4">
          <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden relative">
            <motion.div
              animate={{ width: `${successRate}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full shadow-[0_0_8px_rgba(249,115,22,0.4)]"
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-zinc-500">
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-orange-500" />
              {Math.max(0, issued - paid)} outstanding
            </span>
            <span className="font-[family-name:var(--font-jetbrains)] tabular-nums">
              {issued} issued
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

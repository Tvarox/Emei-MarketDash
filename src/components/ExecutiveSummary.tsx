"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";
import SuccessRateModal from "./SuccessRateModal";
import ReceiptsModal from "./ReceiptsModal";
import TvlModal from "./TvlModal";
import VolumeModal from "./VolumeModal";
import { shortHash } from "@/lib/api";
import type { Invoice } from "@/hooks/useProtocolLive";
import type { AgentResponse, MandateInfo } from "@/lib/api";

interface ExecutiveSummaryProps {
  tvl: number;
  volumeSettled: number;
  paid: number;
  issued: number;
  presented: number;
  receiptsAnchored?: number;
  latestReceiptRoot?: string | null;
  /**
   * Full /emei/public/stats totals payload — passed to detail modals when
   * users drill into a card. Optional so existing callers don't break.
   */
  statsTotals?: {
    invoices_issued: number;
    invoices_presented: number;
    invoices_paid: number;
    invoices_overdue: number;
    mandates_created: number;
    mandates_revoked: number;
    receipts_anchored: number;
    settlements: number;
  };
  /** Extra context the detail modals need. */
  latestReceiptAt?: number | null;
  network?: string | null;
  chainId?: number | null;
  invoices?: Invoice[];
  agents?: AgentResponse[];
  mandates?: MandateInfo[];
  activeMandates?: number;
}

export default function ExecutiveSummary({
  tvl,
  volumeSettled,
  paid,
  issued,
  presented,
  receiptsAnchored = 0,
  latestReceiptRoot = null,
  statsTotals,
  latestReceiptAt = null,
  network = null,
  chainId = null,
  invoices = [],
  agents = [],
  mandates = [],
  activeMandates = 0,
}: ExecutiveSummaryProps) {
  const successRate = issued > 0 ? Math.round((paid / issued) * 100) : 0;
  const [successOpen, setSuccessOpen] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const [tvlOpen, setTvlOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);

  // Synthesize a totals object from the props if the parent didn't pass the
  // full /stats payload, so the modal still has something sensible to render.
  const modalTotals = statsTotals ?? {
    invoices_issued: issued,
    invoices_presented: presented,
    invoices_paid: paid,
    invoices_overdue: 0,
    mandates_created: 0,
    mandates_revoked: 0,
    receipts_anchored: receiptsAnchored,
    settlements: 0,
  };

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        label="Protocol TVL"
        value={tvl}
        unit="mUSD"
        delta="Self-custodial vault"
        deltaPositive
        delay={0}
        onOpen={() => setTvlOpen(true)}
        affordanceClass="group-hover:text-zinc-700"
        ringClass="focus-visible:ring-zinc-400"
      />
      <MetricCard
        label="Volume Settled"
        value={volumeSettled}
        unit="mUSD"
        delta={`${paid} invoices paid`}
        deltaPositive
        delay={0.06}
        onOpen={() => setVolumeOpen(true)}
        accentClass="from-white via-white to-emerald-50/40"
        affordanceClass="group-hover:text-emerald-600"
        ringClass="focus-visible:ring-emerald-500"
      />
      <ReceiptsCard
        receipts={receiptsAnchored}
        latestRoot={latestReceiptRoot}
        delay={0.12}
        onOpen={() => setReceiptsOpen(true)}
      />
      <SuccessRateCard
        paid={paid}
        issued={issued}
        presented={presented}
        successRate={successRate}
        delay={0.18}
        onOpen={() => setSuccessOpen(true)}
      />

      <SuccessRateModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        totals={modalTotals}
        invoices={invoices}
        agents={agents}
      />
      <ReceiptsModal
        open={receiptsOpen}
        onClose={() => setReceiptsOpen(false)}
        receiptsAnchored={modalTotals.receipts_anchored}
        latestReceiptRoot={latestReceiptRoot}
        latestReceiptAt={latestReceiptAt}
        invoicesPaid={modalTotals.invoices_paid}
        invoicesPresented={modalTotals.invoices_presented}
        invoicesOverdue={modalTotals.invoices_overdue}
        settlements={modalTotals.settlements}
        network={network}
        chainId={chainId}
        invoices={invoices}
        agents={agents}
      />
      <TvlModal
        open={tvlOpen}
        onClose={() => setTvlOpen(false)}
        tvl={tvl}
        activeMandates={activeMandates}
        agents={agents}
        mandates={mandates}
      />
      <VolumeModal
        open={volumeOpen}
        onClose={() => setVolumeOpen(false)}
        gmvSettled={volumeSettled}
        invoicesPaid={modalTotals.invoices_paid}
        invoices={invoices}
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
  onOpen,
  accentClass = "from-white via-white to-zinc-50/50",
  affordanceClass = "group-hover:text-zinc-700",
  ringClass = "focus-visible:ring-zinc-400",
}: {
  label: string;
  value: number;
  unit: string;
  delta: string;
  deltaPositive: boolean;
  delay: number;
  onOpen?: () => void;
  accentClass?: string;
  affordanceClass?: string;
  ringClass?: string;
}) {
  const Wrapper: React.ElementType = onOpen ? "button" : "div";
  const wrapperProps = onOpen
    ? {
        type: "button" as const,
        onClick: onOpen,
        "aria-label": `View ${label} details`,
      }
    : {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <Wrapper
        {...wrapperProps}
        className={`group block w-full text-left relative overflow-hidden bg-white rounded-2xl border border-zinc-200/70 px-6 pt-6 pb-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.06)] transition-all ${
          onOpen
            ? `hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)] hover:border-zinc-300/80 cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${ringClass} focus-visible:ring-offset-2`
            : "hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)]"
        }`}
      >
        <div className={`absolute inset-0 bg-gradient-to-br ${accentClass} pointer-events-none`} />

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
          {onOpen && (
            <div className="mt-1 flex justify-end">
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 transition-colors ${affordanceClass}`}
              >
                View details
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </div>
          )}
        </div>
      </Wrapper>
    </motion.div>
  );
}

function ReceiptsCard({
  receipts,
  latestRoot,
  delay,
  onOpen,
}: {
  receipts: number;
  latestRoot: string | null;
  delay: number;
  onOpen: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label="View cryptographic receipts details"
        className="group block w-full text-left relative overflow-hidden bg-white rounded-2xl border border-zinc-200/70 px-6 pt-6 pb-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)] hover:border-zinc-300/80 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
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

          <div className="mt-1 flex justify-end">
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 group-hover:text-emerald-600 transition-colors">
              View details
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

function SuccessRateCard({
  paid,
  issued,
  presented,
  successRate,
  delay,
  onOpen,
}: {
  paid: number;
  issued: number;
  presented: number;
  successRate: number;
  delay: number;
  onOpen: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label="View invoice success rate details"
        className="group block w-full text-left relative overflow-hidden bg-white rounded-2xl border border-zinc-200/70 px-6 pt-6 pb-3 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.06)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-8px_rgba(0,0,0,0.10)] hover:border-zinc-300/80 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
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
            {/* "View details" affordance: lives in its own row at the bottom
                of the card so it never collides with the header or % pill. */}
            <div className="mt-1 flex justify-end">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-zinc-400 group-hover:text-orange-600 transition-colors">
                View details
                <span className="transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </div>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

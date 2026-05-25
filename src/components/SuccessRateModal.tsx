"use client";

import { motion } from "framer-motion";
import Modal from "./Modal";
import type { Invoice } from "@/hooks/useProtocolLive";
import type { AgentResponse } from "@/lib/api";
import { shortAddr } from "@/lib/api";

interface SuccessRateModalProps {
  open: boolean;
  onClose: () => void;
  totals: {
    invoices_issued: number;
    invoices_presented: number;
    invoices_paid: number;
    invoices_overdue: number;
    // The fields below intentionally omitted from the UI — they belong to the
    // Receipts and Mandates surfaces, not the invoice-funnel view.
    mandates_created: number;
    mandates_revoked: number;
    receipts_anchored: number;
    settlements: number;
  };
  /** Windowed paid-invoice timestamps used to compute settlement latency. */
  invoices: Invoice[];
  /** Per-earner activity from /emei/public/agents. */
  agents: AgentResponse[];
}

/**
 * Detail view for the Invoice Success Rate card.
 *
 * Scope is strictly the invoice funnel (Issued → Presented → Paid). Anything
 * about receipts, settlements, or mandates lives in their own dedicated modals
 * to keep this view focused and avoid duplicated context.
 *
 * Sections, top-to-bottom:
 *   1. Header ring (settlement rate %).
 *   2. Funnel bar chart.
 *   3. Two KPIs: settlement rate, median time-to-settlement.
 *   4. Per-earner conversion table (sorted by rate).
 *   5. Compact funnel-only stat row.
 */
export default function SuccessRateModal({
  open,
  onClose,
  totals,
  invoices,
  agents,
}: SuccessRateModalProps) {
  const issued = totals.invoices_issued;
  const presented = totals.invoices_presented;
  const paid = totals.invoices_paid;

  const baseline = Math.max(issued, 1);
  const presentedPct = (presented / baseline) * 100;
  const paidPct = (paid / baseline) * 100;
  const presentedConversion =
    issued > 0 ? Math.round((presented / issued) * 100) : 0;
  const paidConversion = issued > 0 ? Math.round((paid / issued) * 100) : 0;

  // Stuck = issued but not yet presented. Doesn't count overdue (which lives
  // in its own field) — these are simply waiting on a Presented event.
  const stuck = Math.max(0, issued - presented);

  // Settlement latency: median of (paidTick - issuedTick) across the paid
  // invoices we have timestamps for in the windowed feed. Both ticks are
  // unix seconds. Falls back to null when we have no data.
  const settlementLatencySec = computeMedianLatency(invoices);

  const bars = [
    {
      label: "Issued",
      value: issued,
      pct: 100,
      conversion: 100,
      barClass: "from-zinc-500 to-zinc-400",
      dotClass: "bg-zinc-400",
    },
    {
      label: "Presented",
      value: presented,
      pct: presentedPct,
      conversion: presentedConversion,
      barClass: "from-orange-500 to-orange-400",
      dotClass: "bg-orange-500",
    },
    {
      label: "Paid",
      value: paid,
      pct: paidPct,
      conversion: paidConversion,
      barClass: "from-emerald-500 to-emerald-400",
      dotClass: "bg-emerald-500",
    },
  ];

  // Per-earner conversion: only agents who actually issued invoices show up.
  const earners = agents
    .filter((a) => (a.invoices_issued ?? 0) > 0)
    .map((a) => {
      const issuedByAgent = a.invoices_issued ?? 0;
      const paidToAgent = a.invoices_paid_to_them ?? 0;
      const rate =
        issuedByAgent > 0 ? Math.round((paidToAgent / issuedByAgent) * 100) : 0;
      return {
        label: a.label,
        address: a.address,
        issued: issuedByAgent,
        paid: paidToAgent,
        rate,
      };
    })
    .sort((x, y) => y.rate - x.rate);

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Invoice success rate details">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-4 min-w-0">
          <SuccessRing percent={paidConversion} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-orange-400/90 uppercase tracking-[0.18em]">
              Invoice Funnel
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-0.5 truncate">
              Issued → Presented → Paid
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
              {paid.toLocaleString()} of {issued.toLocaleString()} settled ·{" "}
              {paidConversion}% rate
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md p-1.5 transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-6 overflow-y-auto space-y-6">
        {/* Funnel bars */}
        <section>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-3">
            Lifetime Funnel
          </p>
          <div className="space-y-4">
            {bars.map((b, i) => (
              <div key={b.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${b.dotClass}`} />
                    <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                      {b.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-base font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
                      {b.value.toLocaleString()}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-semibold tabular-nums">
                      {b.conversion}%
                    </span>
                  </div>
                </div>
                <div className="h-2.5 bg-white/[0.06] rounded-full overflow-hidden ring-1 ring-inset ring-white/[0.04]">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${b.pct}%` }}
                    transition={{
                      duration: 0.8,
                      delay: 0.05 + i * 0.08,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className={`h-full bg-gradient-to-r ${b.barClass} rounded-full`}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 gap-3">
          <KPI
            label="Settlement rate"
            value={`${paidConversion}%`}
            sub={`${paid.toLocaleString()} of ${issued.toLocaleString()} issued`}
            accent
          />
          <KPI
            label="Median time-to-pay"
            value={formatDuration(settlementLatencySec)}
            sub={
              settlementLatencySec == null
                ? "Not enough recent paid data"
                : "Across recent paid invoices"
            }
          />
        </section>

        {/* Per-earner conversion */}
        {earners.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-2">
              Conversion by Earner
              <span className="ml-1.5 font-normal text-zinc-600 normal-case tracking-normal">
                · paid / issued per agent
              </span>
            </p>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              {earners.map((e, i) => (
                <div
                  key={e.address}
                  className={`px-3 py-2.5 ${
                    i > 0 ? "border-t border-white/[0.04]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5 gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[12px] font-bold text-white truncate">
                        {e.label}
                      </span>
                      <code className="text-[10px] text-zinc-500 font-[family-name:var(--font-jetbrains)] hidden sm:inline">
                        {shortAddr(e.address)}
                      </code>
                    </div>
                    <div className="flex items-baseline gap-1.5 shrink-0">
                      <span className="text-[12px] font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
                        {e.paid}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-[family-name:var(--font-jetbrains)] tabular-nums">
                        / {e.issued}
                      </span>
                      <span
                        className={`text-[10px] font-bold tabular-nums ml-1 ${
                          e.rate >= 75
                            ? "text-emerald-400"
                            : e.rate >= 50
                              ? "text-orange-400"
                              : "text-red-400"
                        }`}
                      >
                        {e.rate}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${e.rate}%` }}
                      transition={{
                        duration: 0.7,
                        delay: 0.1 + i * 0.04,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={`h-full rounded-full bg-gradient-to-r ${
                        e.rate >= 75
                          ? "from-emerald-500 to-emerald-400"
                          : e.rate >= 50
                            ? "from-orange-500 to-orange-400"
                            : "from-red-500 to-red-400"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Funnel-only stat row */}
        <section>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-2">
            At a glance
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Issued" value={issued} />
            <Stat label="Presented" value={presented} />
            <Stat label="Paid" value={paid} />
            <Stat
              label="Overdue"
              value={totals.invoices_overdue}
              warn={totals.invoices_overdue > 0}
            />
          </div>
          {stuck > 0 && (
            <p className="mt-2 text-[11px] text-zinc-500 tabular-nums">
              <span className="font-bold text-orange-400">{stuck}</span>{" "}
              <span className="text-zinc-400">
                issued but not yet presented — waiting on a Presented event.
              </span>
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}

/**
 * Median (paidTick − issuedTick) in seconds across paid invoices that have
 * both timestamps. Returns null when fewer than 3 samples exist so we don't
 * advertise a stat from a tiny sample.
 */
function computeMedianLatency(invoices: Invoice[]): number | null {
  const samples = invoices
    .filter(
      (i) =>
        i.status === "Paid" &&
        i.paidTick != null &&
        i.issuedTick != null &&
        i.paidTick > i.issuedTick
    )
    .map((i) => (i.paidTick as number) - i.issuedTick);

  if (samples.length < 3) return null;
  samples.sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  return samples.length % 2 === 0
    ? Math.round((samples[mid - 1] + samples[mid]) / 2)
    : samples[mid];
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function SuccessRing({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, percent));
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const dash = (safe / 100) * circumference;

  return (
    <div className="relative shrink-0">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="5"
        />
        <motion.circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="url(#success-ring-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference}` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="success-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
          {safe}%
        </span>
      </div>
    </div>
  );
}

function KPI({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? "bg-orange-500/[0.08] border-orange-500/30"
          : "bg-white/[0.03] border-white/[0.06]"
      }`}
    >
      <p
        className={`text-[10px] font-bold uppercase tracking-[0.14em] ${
          accent ? "text-orange-300/90" : "text-zinc-400"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1.5 text-2xl font-bold font-[family-name:var(--font-jetbrains)] tabular-nums ${
          accent ? "text-orange-200" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-500 tabular-nums">{sub}</p>
    </div>
  );
}

function Stat({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-white/[0.02] px-3 py-2.5 transition-colors ${
        warn
          ? "border-red-500/30 hover:border-red-500/50"
          : "border-white/[0.06] hover:border-white/[0.12]"
      }`}
    >
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
        {label}
      </p>
      <p
        className={`mt-1 text-base font-bold font-[family-name:var(--font-jetbrains)] tabular-nums ${
          warn ? "text-red-400" : "text-white"
        }`}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

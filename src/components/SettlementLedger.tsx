"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import type { Invoice, InvoiceStatus } from "@/hooks/useProtocolSimulation";

interface SettlementLedgerProps {
  events: Invoice[];
}

type FilterMode = "all" | "Issued" | "Presented" | "Paid";

export default function SettlementLedger({ events }: SettlementLedgerProps) {
  const [filter, setFilter] = useState<FilterMode>("all");

  const filtered = useMemo(() => {
    const list =
      filter === "all" ? events : events.filter((e) => e.status === filter);
    return list.slice(0, 8);
  }, [events, filter]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-2xl border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-zinc-100 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-900 tracking-tight">
            Live Settlement Ledger
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Recent invoice events across the EMEI network
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-zinc-100/70 rounded-lg p-1">
          {(["all", "Issued", "Presented", "Paid"] as FilterMode[]).map(
            (mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className={`text-[11px] font-semibold px-3 py-1 rounded-md transition-all ${
                  filter === mode
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                {mode === "all" ? "All" : mode}
                <span className="ml-1.5 text-[10px] text-zinc-400 font-[family-name:var(--font-jetbrains)] tabular-nums">
                  {mode === "all"
                    ? events.length
                    : events.filter((e) => e.status === mode).length}
                </span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Table - fixed-height container prevents shifting */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
          <thead className="bg-zinc-50/50">
            <tr className="text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] border-b border-zinc-100">
              <th className="px-6 py-3 w-[140px]">Status</th>
              <th className="px-6 py-3 w-[120px]">Invoice ID</th>
              <th className="px-6 py-3 w-[140px]">Amount</th>
              <th className="px-6 py-3">Category</th>
              <th className="px-6 py-3 text-right w-[180px]">Proof</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.map((event) => (
              <LedgerRow key={event.id} event={event} />
            ))}
            {/* Pad rows so the table doesn't shrink/grow when filtering */}
            {filtered.length < 8 &&
              Array.from({ length: 8 - filtered.length }).map((_, i) => (
                <tr key={`pad-${i}`} className="h-[52px]">
                  <td className="px-6 py-3.5" colSpan={5}>
                    &nbsp;
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-zinc-100 flex items-center justify-between bg-zinc-50/30">
        <span className="text-[11px] text-zinc-500 tabular-nums">
          Showing{" "}
          <span className="font-semibold text-zinc-700">{filtered.length}</span>{" "}
          of{" "}
          <span className="font-semibold text-zinc-700">{events.length}</span>{" "}
          events
        </span>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Streaming live
        </div>
      </div>
    </motion.section>
  );
}

function LedgerRow({ event }: { event: Invoice }) {
  // Each row mounts once (keyed by id), so motion's `initial` fires exactly once.
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="h-[52px] hover:bg-zinc-50/60"
      style={{
        animation: "row-flash 1.6s ease-out both",
      }}
    >
      <td className="px-6 py-3.5">
        <StatusPill status={event.status} />
      </td>
      <td className="px-6 py-3.5">
        <span className="font-[family-name:var(--font-jetbrains)] text-[13px] font-semibold text-zinc-900">
          #{event.id}
        </span>
      </td>
      <td className="px-6 py-3.5">
        <span className="font-[family-name:var(--font-jetbrains)] text-[13px] font-bold text-zinc-900 tabular-nums">
          {event.amount.toFixed(2)}
        </span>
        <span className="text-[11px] text-zinc-400 ml-1 font-medium">mUSD</span>
      </td>
      <td className="px-6 py-3.5">
        <span className="inline-flex items-center text-[11px] font-medium text-zinc-600 bg-zinc-100 rounded-md px-2 py-0.5 font-[family-name:var(--font-jetbrains)]">
          {event.category}
        </span>
      </td>
      <td className="px-6 py-3.5 text-right">
        <a
          href={`https://sepolia.mantlescan.xyz/tx/${event.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-500 hover:text-orange-600 transition-colors group"
        >
          View on Explorer
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
          >
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </a>
      </td>
    </motion.tr>
  );
}

function StatusPill({ status }: { status: InvoiceStatus }) {
  const styles = {
    Issued: {
      bg: "bg-zinc-100",
      text: "text-zinc-600",
      dot: "bg-zinc-400",
      border: "border-zinc-200",
    },
    Presented: {
      bg: "bg-orange-50",
      text: "text-orange-700",
      dot: "bg-orange-500",
      border: "border-orange-200",
    },
    Paid: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      dot: "bg-emerald-500",
      border: "border-emerald-200",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold border rounded-full px-2.5 py-0.5 transition-colors duration-300 ${styles.bg} ${styles.text} ${styles.border}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${styles.dot} ${
          status === "Presented" ? "animate-pulse" : ""
        }`}
      />
      {status}
    </span>
  );
}

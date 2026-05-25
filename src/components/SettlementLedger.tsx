"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Invoice, InvoiceStatus } from "@/hooks/useProtocolSimulation";

interface SettlementLedgerProps {
  events: Invoice[];
  /**
   * Lifetime, protocol-wide totals (from /emei/public/stats). Surfaced in the
   * filter chips so the chip counts reconcile with ExecutiveSummary.
   * If omitted, chip counts fall back to the windowed `events` array.
   */
  totals?: {
    issued: number;
    presented: number;
    paid: number;
  };
}

type FilterMode = "all" | "Issued" | "Presented" | "Paid";
type CategoryFilter = "all" | "compute" | "analytics" | "data-signal";

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "compute", label: "compute" },
  { value: "analytics", label: "analytics" },
  { value: "data-signal", label: "data-signal" },
];

/**
 * Lifecycle is monotonic: every invoice was Issued; every Presented row is
 * also Issued; every Paid row is also Issued AND Presented. We have to
 * recover that monotonicity from the windowed event slice — pagination can
 * cut the older Presented event for a Paid invoice, leaving `presentedTick`
 * undefined even though the invoice was definitely presented at some point.
 *
 *   - phase = Issued    → every invoice qualifies
 *   - phase = Presented → has presentedTick OR has paidTick (Paid implies Presented)
 *   - phase = Paid      → has paidTick
 */
function hasReachedPhase(event: Invoice, phase: FilterMode): boolean {
  if (phase === "all") return true;
  if (phase === "Issued") return true;
  if (phase === "Presented")
    return event.presentedTick != null || event.paidTick != null;
  if (phase === "Paid") return event.paidTick != null;
  return false;
}

/**
 * For a given filter, pick which timestamp to surface in the Timeline column.
 * "All" defaults to the most-recent transition.
 */
function timestampForPhase(
  event: Invoice,
  phase: FilterMode
): { ts: number | undefined; label: string } {
  if (phase === "Issued") return { ts: event.issuedTick, label: "issued" };
  if (phase === "Presented")
    return { ts: event.presentedTick, label: "presented" };
  if (phase === "Paid") return { ts: event.paidTick, label: "paid" };
  // "all" → row's current status
  if (event.status === "Paid") return { ts: event.paidTick, label: "paid" };
  if (event.status === "Presented")
    return { ts: event.presentedTick, label: "presented" };
  return { ts: event.issuedTick, label: "issued" };
}

/**
 * Format a unix-second timestamp as a short human-friendly relative or
 * clock time. Falls back to an em-dash when missing.
 *
 *   < 60s  → "just now"
 *   < 60m  → "Xm ago"
 *   < 24h  → "Xh ago"
 *   else   → MMM D, HH:mm
 */
function formatTimestamp(ts: number | undefined, now: number): string {
  if (!ts || !Number.isFinite(ts)) return "—";
  const seconds = Math.max(0, Math.floor(now / 1000) - ts);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAbsolute(ts: number | undefined): string {
  if (!ts || !Number.isFinite(ts)) return "—";
  return new Date(ts * 1000).toLocaleString();
}

export default function SettlementLedger({
  events,
  totals,
}: SettlementLedgerProps) {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const filtersWrapRef = useRef<HTMLDivElement | null>(null);

  // Keep relative timestamps fresh without coupling to the poll cycle.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Close the filter popover on outside click or Escape.
  useEffect(() => {
    if (!filtersOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!filtersWrapRef.current) return;
      if (!filtersWrapRef.current.contains(e.target as Node)) {
        setFiltersOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  const filtered = useMemo(() => {
    const list = events.filter((e) => {
      if (!hasReachedPhase(e, filter)) return false;
      if (category !== "all" && e.category !== category) return false;
      return true;
    });
    return list.slice(0, 8);
  }, [events, filter, category]);

  // Chip counts: prefer protocol-wide totals so they reconcile with the
  // ExecutiveSummary card. Fall back to the windowed events array. Whenever a
  // category filter is active we *must* count from the windowed events because
  // /stats does not expose category breakdowns.
  const chipCount = (mode: FilterMode): number => {
    if (category !== "all") {
      return events.filter(
        (e) => hasReachedPhase(e, mode) && e.category === category
      ).length;
    }
    if (totals) {
      if (mode === "all") return totals.issued;
      if (mode === "Issued") return totals.issued;
      if (mode === "Presented") return totals.presented;
      if (mode === "Paid") return totals.paid;
    }
    return events.filter((e) => hasReachedPhase(e, mode)).length;
  };

  const activeFilterCount =
    (filter !== "all" ? 1 : 0) + (category !== "all" ? 1 : 0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-2xl border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] overflow-hidden"
    >
      {/* Header */}
      <div className="px-6 py-5 border-b border-zinc-100">
        <h2 className="text-base font-bold text-zinc-900 tracking-tight">
          Live Settlement Ledger
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Recent invoice events across the EMEI network
        </p>
      </div>

      {/* Filter Toolbar — single hamburger that opens a popover with both
          status and category filters. Sits above the table so it lives close
          to what it controls. */}
      <div className="px-6 py-3 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30">
        <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
          {filter === "all" ? "All invoices" : `${filter} invoices`}
          {category !== "all" && (
            <span className="ml-1.5 text-zinc-400 font-normal normal-case tracking-normal">
              · {category}
            </span>
          )}
        </div>

        <div className="relative" ref={filtersWrapRef}>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
            aria-haspopup="true"
            className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-md border transition-colors ${
              filtersOpen || activeFilterCount > 0
                ? "bg-white border-zinc-300 text-zinc-900 shadow-sm"
                : "bg-white border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300"
            }`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="7" y1="12" x2="20" y2="12" />
              <line x1="10" y1="18" x2="20" y2="18" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold tabular-nums">
                {activeFilterCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-xl border border-zinc-200 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.15)] z-20 overflow-hidden"
                role="dialog"
                aria-label="Ledger filters"
              >
                {/* Status section */}
                <div className="px-4 py-3 border-b border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-2">
                    Status
                  </p>
                  <div className="grid grid-cols-2 gap-1">
                    {(
                      ["all", "Issued", "Presented", "Paid"] as FilterMode[]
                    ).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setFilter(mode)}
                        className={`flex items-center justify-between text-[12px] font-semibold px-2.5 py-1.5 rounded-md transition-colors ${
                          filter === mode
                            ? "bg-zinc-900 text-white"
                            : "text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        <span>{mode === "all" ? "All" : mode}</span>
                        <span
                          className={`text-[10px] font-[family-name:var(--font-jetbrains)] tabular-nums ${
                            filter === mode ? "text-zinc-300" : "text-zinc-400"
                          }`}
                        >
                          {chipCount(mode)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category section */}
                <div className="px-4 py-3 border-b border-zinc-100">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.12em] mb-2">
                    Category
                  </p>
                  <div className="flex flex-col gap-1">
                    {CATEGORY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCategory(opt.value)}
                        className={`flex items-center justify-between text-[12px] font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                          category === opt.value
                            ? "bg-orange-50 text-orange-700"
                            : "text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        <span className="font-[family-name:var(--font-jetbrains)]">
                          {opt.label}
                        </span>
                        {category === opt.value && (
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Footer actions */}
                <div className="px-4 py-2.5 flex items-center justify-between bg-zinc-50/50">
                  <button
                    type="button"
                    onClick={() => {
                      setFilter("all");
                      setCategory("all");
                    }}
                    disabled={activeFilterCount === 0}
                    className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 disabled:text-zinc-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(false)}
                    className="text-[11px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 px-3 py-1.5 rounded-md transition-colors"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Table - fixed-height container prevents shifting */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
          <thead className="bg-zinc-50/50">
            <tr className="text-left text-[10px] font-semibold text-zinc-500 uppercase tracking-[0.12em] border-b border-zinc-100">
              <th className="px-6 py-3 w-[140px]">Status</th>
              <th className="px-6 py-3 w-[100px]">Invoice ID</th>
              <th className="px-6 py-3 w-[120px]">Amount</th>
              <th className="px-6 py-3 w-[140px]">Category</th>
              <th className="px-6 py-3 w-[160px]">Timeline</th>
              <th className="px-6 py-3 text-right w-[160px]">Proof</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.map((event) => (
              <LedgerRow
                key={event.id}
                event={event}
                now={now}
                filter={filter}
              />
            ))}
            {/* Pad rows so the table doesn't shrink/grow when filtering */}
            {filtered.length < 8 &&
              Array.from({ length: 8 - filtered.length }).map((_, i) => (
                <tr key={`pad-${i}`} className="h-[52px]">
                  <td className="px-6 py-3.5" colSpan={6}>
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
          <span className="font-semibold text-zinc-700">
            {totals?.issued ?? events.length}
          </span>{" "}
          invoices
        </span>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Streaming live
        </div>
      </div>
    </motion.section>
  );
}

function LedgerRow({
  event,
  now,
  filter,
}: {
  event: Invoice;
  now: number;
  filter: FilterMode;
}) {
  // Pick the timestamp that matches the active filter so the Timeline column
  // answers the question implied by the chosen tab ("when was this presented?").
  const { ts: primaryTs, label: phaseLabel } = timestampForPhase(event, filter);

  const timelineTooltip = [
    `Issued: ${formatAbsolute(event.issuedTick)}`,
    event.presentedTick != null
      ? `Presented: ${formatAbsolute(event.presentedTick)}`
      : null,
    event.paidTick != null ? `Paid: ${formatAbsolute(event.paidTick)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

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
          {event.id < 0 ? "#pending" : `#${event.id}`}
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
      <td className="px-6 py-3.5" title={timelineTooltip}>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-semibold text-zinc-700 tabular-nums">
            {formatTimestamp(primaryTs, now)}
          </span>
          <span className="text-[10px] text-zinc-400 font-medium">
            {phaseLabel}
          </span>
        </div>
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

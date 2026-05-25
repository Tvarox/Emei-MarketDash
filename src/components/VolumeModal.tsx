"use client";

import { motion } from "framer-motion";
import Modal from "./Modal";
import type { Invoice } from "@/hooks/useProtocolLive";

interface VolumeModalProps {
  open: boolean;
  onClose: () => void;
  /** Lifetime GMV settled, mUSD. */
  gmvSettled: number;
  /** Lifetime paid invoice count — denominator for average ticket size. */
  invoicesPaid: number;
  /** Windowed paid invoices used to compute distribution + categories. */
  invoices: Invoice[];
}

/**
 * Detail view for the Volume Settled card.
 *
 * Scope: how money flowed. Average ticket, biggest ticket in the window,
 * category split, and a payment-size distribution bucketed for readability.
 *
 * Deliberately omits anything about who, when, or whether anchored — those
 * stories live in the Success Rate, Receipts, and ledger views.
 */
export default function VolumeModal({
  open,
  onClose,
  gmvSettled,
  invoicesPaid,
  invoices,
}: VolumeModalProps) {
  const paid = invoices.filter((i) => i.status === "Paid");
  const paidAmounts = paid.map((i) => i.amount);

  // Average ticket (lifetime, exact) — not from the window so it's stable.
  const avgTicket = invoicesPaid > 0 ? gmvSettled / invoicesPaid : 0;

  // Largest payment we've actually observed in the window.
  const largest = paidAmounts.reduce((m, v) => (v > m ? v : m), 0);

  // Bucket distribution of payment amounts. Buckets are tuned to the API:
  // most invoices are ~1.00, with 2–6 and 6+ outliers.
  const buckets: { label: string; predicate: (v: number) => boolean }[] = [
    { label: "= 1 mUSD", predicate: (v) => v <= 1 + 1e-9 },
    { label: "1–2 mUSD", predicate: (v) => v > 1 && v <= 2 },
    { label: "2–6 mUSD", predicate: (v) => v > 2 && v <= 6 },
    { label: "> 6 mUSD", predicate: (v) => v > 6 },
  ];

  const distribution = buckets.map((b) => ({
    label: b.label,
    count: paidAmounts.filter(b.predicate).length,
  }));
  const distMax = distribution.reduce((m, d) => (d.count > m ? d.count : m), 0);

  // Category split — sum amounts per category among the paid invoices we can
  // see. Strictly windowed (the API doesn't expose per-category lifetime
  // GMV today), but it answers "where is the money flowing right now?".
  const byCategory = new Map<string, { count: number; total: number }>();
  for (const inv of paid) {
    const key = inv.category || "uncategorized";
    const cur = byCategory.get(key) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += inv.amount;
    byCategory.set(key, cur);
  }
  const categories = Array.from(byCategory.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);
  const categoryTotal = categories.reduce((s, c) => s + c.total, 0);

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Volume settled details">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-4 min-w-0">
          <VolumeMark amount={gmvSettled} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-400/90 uppercase tracking-[0.18em]">
              Volume Settled
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-0.5 truncate">
              Cumulative Settled Throughput
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
              Avg ticket {avgTicket.toFixed(2)} mUSD · biggest in window{" "}
              {largest.toFixed(2)} mUSD
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
        {/* Payment size distribution */}
        <section>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-2">
            Payment Size Distribution
            <span className="ml-1.5 font-normal text-zinc-600 normal-case tracking-normal">
              · across {paidAmounts.length} recent paid
            </span>
          </p>
          {paidAmounts.length === 0 ? (
            <p className="text-[12px] text-zinc-500 italic">
              No paid invoices in the current window.
            </p>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              {distribution.map((d, i) => {
                const pct = distMax > 0 ? (d.count / distMax) * 100 : 0;
                const share =
                  paidAmounts.length > 0
                    ? Math.round((d.count / paidAmounts.length) * 100)
                    : 0;
                return (
                  <div
                    key={d.label}
                    className={`px-3 py-2.5 ${
                      i > 0 ? "border-t border-white/[0.04]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[12px] font-medium text-zinc-300 font-[family-name:var(--font-jetbrains)]">
                        {d.label}
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[12px] font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
                          {d.count}
                        </span>
                        <span className="text-[10px] text-zinc-500 tabular-nums">
                          {share}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{
                          duration: 0.7,
                          delay: 0.05 + i * 0.05,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* By category */}
        {categories.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-2">
              Flow by Category
              <span className="ml-1.5 font-normal text-zinc-600 normal-case tracking-normal">
                · among recent paid
              </span>
            </p>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              {categories.map((c, i) => {
                const max = categories[0].total || 1;
                const pct = (c.total / max) * 100;
                const share =
                  categoryTotal > 0
                    ? Math.round((c.total / categoryTotal) * 100)
                    : 0;
                return (
                  <div
                    key={c.name}
                    className={`px-3 py-2.5 ${
                      i > 0 ? "border-t border-white/[0.04]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-3">
                      <span className="text-[12px] font-medium text-zinc-300 font-[family-name:var(--font-jetbrains)] truncate">
                        {c.name}
                      </span>
                      <div className="flex items-baseline gap-1.5 shrink-0">
                        <span className="text-[12px] font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
                          {c.total.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-zinc-500">mUSD</span>
                        <span className="text-[10px] font-bold text-emerald-400 tabular-nums ml-1">
                          {share}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{
                          duration: 0.7,
                          delay: 0.1 + i * 0.04,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* At a glance */}
        <section>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-2">
            At a glance
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="GMV settled" value={gmvSettled.toFixed(2)} unit="mUSD" />
            <Stat label="Avg ticket" value={avgTicket.toFixed(2)} unit="mUSD" />
            <Stat label="Biggest seen" value={largest.toFixed(2)} unit="mUSD" />
          </div>
        </section>
      </div>
    </Modal>
  );
}

/** Decorative emerald mark with the GMV value engraved — replaces the
 *  ring used elsewhere because there's no natural percentage to dial. */
function VolumeMark({ amount }: { amount: number }) {
  return (
    <div className="relative shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/[0.18] to-emerald-500/[0.04] border border-emerald-500/30 flex flex-col items-center justify-center">
      <span className="text-[14px] font-bold text-emerald-300 font-[family-name:var(--font-jetbrains)] tabular-nums leading-none">
        {amount.toFixed(0)}
      </span>
      <span className="mt-0.5 text-[8px] font-semibold text-emerald-400/80 uppercase tracking-wider">
        mUSD
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] px-3 py-2.5 transition-colors">
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-base font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
        {value}
        {unit && (
          <span className="text-[10px] text-zinc-500 ml-1">{unit}</span>
        )}
      </p>
    </div>
  );
}

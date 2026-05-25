"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Modal from "./Modal";
import type { Invoice } from "@/hooks/useProtocolLive";
import type { AgentResponse } from "@/lib/api";
import { shortAddr, shortHash } from "@/lib/api";

interface ReceiptsModalProps {
  open: boolean;
  onClose: () => void;
  receiptsAnchored: number;
  latestReceiptRoot: string | null;
  latestReceiptAt: number | null;
  /** Lifetime paid invoices count — denominator for coverage. */
  invoicesPaid: number;
  invoicesPresented: number;
  invoicesOverdue: number;
  settlements: number;
  network: string | null;
  chainId: number | null;
  /** Recent invoices (windowed, ≤ MAX_LEDGER) — only Paid rows are receipted. */
  invoices: Invoice[];
  /** Per-agent activity for the attribution table. */
  agents: AgentResponse[];
}

/**
 * Resolve the public block-explorer base URL for a given chain id. We map only
 * the networks the EMEI facilitator targets today; fall back to Etherscan.
 */
function explorerBase(chainId: number | null): string {
  if (chainId === 5003) return "https://sepolia.mantlescan.xyz";
  if (chainId === 5000) return "https://mantlescan.xyz";
  return "https://etherscan.io";
}

function formatRelative(ts: number | null | undefined): string {
  if (!ts || !Number.isFinite(ts)) return "—";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return new Date(ts * 1000).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Detail view for the Cryptographic Receipts card.
 *
 * Layout, top-to-bottom:
 *   1. Header strip: coverage ring (anchored / paid) + title + close.
 *   2. Latest Merkle root with copy + view-on-explorer buttons, and a
 *      "Last anchored {N}m ago · {network}" line.
 *   3. Recent paid invoices (the events that produced receipts), each with
 *      a tx-hash link to the block explorer.
 *   4. Per-agent attribution — receipts per agent derived from invoice flow.
 *   5. Compact stat row at the bottom for everything else.
 */
export default function ReceiptsModal({
  open,
  onClose,
  receiptsAnchored,
  latestReceiptRoot,
  latestReceiptAt,
  invoicesPaid,
  invoicesPresented,
  invoicesOverdue,
  settlements,
  network,
  chainId,
  invoices,
  agents,
}: ReceiptsModalProps) {
  const [copied, setCopied] = useState(false);

  // Coverage = receipts anchored / lifetime paid invoices. Caps at 100% so we
  // don't render >100% if the receipts service ever runs ahead.
  const coverage =
    invoicesPaid > 0
      ? Math.min(100, Math.round((receiptsAnchored / invoicesPaid) * 100))
      : 0;

  const expBase = explorerBase(chainId);
  const recentPaid = invoices
    .filter((i) => i.status === "Paid" && i.paidTick != null)
    .slice(0, 6);

  // Each Paid invoice produces a receipt; sum (paid_to_them + paid_by_them) to
  // attribute touches per agent. This double-counts (every paid invoice has
  // exactly one earner and one payer), so we sort by the sum and label it as
  // "touches" rather than "receipts" in the column header to be accurate.
  const agentRows = agents
    .map((a) => ({
      label: a.label,
      address: a.address,
      touches: (a.invoices_paid_to_them ?? 0) + (a.invoices_paid_by_them ?? 0),
      role:
        (a.invoices_paid_to_them ?? 0) >= (a.invoices_paid_by_them ?? 0)
          ? "Earner"
          : "Payer",
    }))
    .filter((a) => a.touches > 0)
    .sort((x, y) => y.touches - x.touches);

  const handleCopy = async () => {
    if (!latestReceiptRoot) return;
    try {
      await navigator.clipboard.writeText(latestReceiptRoot);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop — clipboard might be blocked */
    }
  };

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Cryptographic receipts details">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-4 min-w-0">
          <CoverageRing percent={coverage} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-emerald-400/90 uppercase tracking-[0.18em]">
              Cryptographic Receipts
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-0.5 truncate">
              Anchored on-chain
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
              {receiptsAnchored.toLocaleString()} of {invoicesPaid.toLocaleString()}{" "}
              paid invoices · {coverage}% coverage
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 text-zinc-400 hover:text-white hover:bg-white/10 rounded-md p-1.5 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Body */}
      <div className="px-6 py-6 overflow-y-auto space-y-6">
        {/* Latest root */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em]">
              Latest Merkle Root
            </p>
            <p className="text-[10px] text-zinc-500 tabular-nums">
              Last anchored {formatRelative(latestReceiptAt)}
              {network && (
                <span className="ml-2 text-zinc-600">·</span>
              )}
              {network && (
                <span className="ml-2 text-zinc-400 font-semibold">
                  {network}
                  {chainId != null && (
                    <span className="text-zinc-500 font-normal">
                      {" "}· chain {chainId}
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 flex items-center gap-2">
            <code className="flex-1 text-[12px] text-emerald-300 font-[family-name:var(--font-jetbrains)] truncate">
              {latestReceiptRoot ?? "—"}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!latestReceiptRoot}
              aria-label="Copy Merkle root"
              className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-zinc-300 hover:text-white bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed px-2 py-1 rounded-md transition-colors"
            >
              {copied ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </section>

        {/* Recent receipts (paid invoices) */}
        <section>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-2">
            Recent Receipts
          </p>
          {recentPaid.length === 0 ? (
            <p className="text-[12px] text-zinc-500 italic">
              No paid invoices in the current window.
            </p>
          ) : (
            <div className="rounded-xl border border-white/[0.06] divide-y divide-white/[0.04] overflow-hidden">
              {recentPaid.map((inv) => (
                <a
                  key={inv.id}
                  href={`${expBase}/tx/${inv.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-[12px] font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
                      #{inv.id}
                    </span>
                    <span className="text-[11px] font-medium text-zinc-400 tabular-nums">
                      {inv.amount.toFixed(2)} mUSD
                    </span>
                    <span className="text-[10px] text-zinc-500 font-[family-name:var(--font-jetbrains)] hidden sm:inline">
                      {inv.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-zinc-500 tabular-nums">
                      {formatRelative(inv.paidTick)}
                    </span>
                    <code className="hidden sm:inline text-[10px] text-zinc-500 font-[family-name:var(--font-jetbrains)]">
                      {shortHash(inv.txHash, 6, 4)}
                    </code>
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all"
                      aria-hidden="true"
                    >
                      <path d="M7 17L17 7" />
                      <path d="M7 7h10v10" />
                    </svg>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Per-agent attribution */}
        {agentRows.length > 0 && (
          <section>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-2">
              Receipt Touches by Agent
              <span className="ml-1.5 font-normal text-zinc-600 normal-case tracking-normal">
                · each settled invoice touches one earner and one payer
              </span>
            </p>
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              {agentRows.map((a, i) => {
                const max = agentRows[0].touches || 1;
                const pct = (a.touches / max) * 100;
                return (
                  <div
                    key={a.address}
                    className={`px-3 py-2.5 ${
                      i > 0 ? "border-t border-white/[0.04]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[12px] font-bold text-white truncate">
                          {a.label}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                          {a.role}
                        </span>
                        <code className="text-[10px] text-zinc-500 font-[family-name:var(--font-jetbrains)] hidden sm:inline">
                          {shortAddr(a.address)}
                        </code>
                      </div>
                      <span className="text-[12px] font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
                        {a.touches.toLocaleString()}
                      </span>
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
                        className={`h-full rounded-full bg-gradient-to-r ${
                          a.role === "Earner"
                            ? "from-emerald-500 to-emerald-400"
                            : "from-orange-500 to-orange-400"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Footer stats */}
        <section>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-2">
            At a glance
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Anchored" value={receiptsAnchored} />
            <Stat label="Paid" value={invoicesPaid} />
            <Stat label="Presented" value={invoicesPresented} />
            <Stat label="Settlements" value={settlements} />
            <Stat label="Overdue" value={invoicesOverdue} warn={invoicesOverdue > 0} />
          </div>
        </section>
      </div>
    </Modal>
  );
}

/** Coverage ring rendered with SVG so we don't need a chart library. */
function CoverageRing({ percent }: { percent: number }) {
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
          stroke="url(#receipts-ring-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference}` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="receipts-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#10b981" />
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

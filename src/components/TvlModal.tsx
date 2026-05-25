"use client";

import { motion } from "framer-motion";
import Modal from "./Modal";
import type { AgentResponse, MandateInfo } from "@/lib/api";
import { parseAmount, shortAddr } from "@/lib/api";

interface TvlModalProps {
  open: boolean;
  onClose: () => void;
  /** Total value locked across all agent vaults (mUSD). */
  tvl: number;
  /** Number of currently active mandates. */
  activeMandates: number;
  /** Per-agent vault holdings. */
  agents: AgentResponse[];
  /** Active + revoked mandate records, used to derive authorized capacity. */
  mandates: MandateInfo[];
}

/**
 * Detail view for the Protocol TVL card.
 *
 * Scope is strictly the capital layer — where the locked value lives, who
 * controls it, and how much spending power has been authorized via mandates.
 *
 * Sections:
 *   1. Header: TVL ring (concentration) + headline.
 *   2. Agent vault breakdown — per-agent locked balance with bars.
 *   3. Authorized spend (active mandates) — total cap, remaining, utilization.
 *   4. Compact stat row: TVL · Active mandates · Authorized cap.
 */
export default function TvlModal({
  open,
  onClose,
  tvl,
  activeMandates,
  agents,
  mandates,
}: TvlModalProps) {
  // Per-agent vault balances. Filter out agents with zero so we don't pad the
  // table with payers (their balances zero out as they spend).
  const vaults = agents
    .map((a) => ({
      label: a.label,
      address: a.address,
      balance: parseAmount(a.vault_balance_musd, 0),
    }))
    .filter((a) => a.balance > 0)
    .sort((x, y) => y.balance - x.balance);

  const sumVaults = vaults.reduce((s, a) => s + a.balance, 0);
  const topShare = sumVaults > 0 ? Math.round((vaults[0]?.balance / sumVaults) * 100) : 0;

  // Mandate accounting. Only active mandates contribute to "authorized"; we
  // separately count revoked ones to give the user a sense of churn.
  // The live API uses `status: "active" | "revoked"`; older shapes used a
  // boolean `revoked` flag, so we accept both for resilience.
  const active = mandates.filter(
    (m) => m.status !== "revoked" && m.revoked !== true
  );
  const revokedCount = mandates.length - active.length;
  const totalCap = active.reduce(
    (s, m) => s + parseAmount(m.spend_cap_musd, 0),
    0
  );
  const totalRemaining = active.reduce(
    (s, m) => s + parseAmount(m.remaining_cap_musd ?? m.remaining_musd, 0),
    0
  );
  const totalSpent = Math.max(0, totalCap - totalRemaining);
  const utilization = totalCap > 0 ? Math.round((totalSpent / totalCap) * 100) : 0;

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Protocol TVL details">
      {/* Header */}
      <div className="px-6 pt-6 pb-5 flex items-start justify-between gap-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-4 min-w-0">
          <ConcentrationRing percent={topShare} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-[0.18em]">
              Protocol TVL
            </p>
            <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight mt-0.5 truncate">
              Capital Locked Across Agent Vaults
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
              {tvl.toFixed(2)} mUSD across {vaults.length} active{" "}
              {vaults.length === 1 ? "vault" : "vaults"}
              {vaults.length > 0 && (
                <>
                  {" "}· top holder {topShare}%
                </>
              )}
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
        {/* Agent vaults */}
        <section>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-2">
            Vault Holdings
          </p>
          {vaults.length === 0 ? (
            <p className="text-[12px] text-zinc-500 italic">
              No agent currently holds a positive balance.
            </p>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              {vaults.map((v, i) => {
                const max = vaults[0].balance || 1;
                const pct = (v.balance / max) * 100;
                const share =
                  sumVaults > 0
                    ? Math.round((v.balance / sumVaults) * 100)
                    : 0;
                return (
                  <div
                    key={v.address}
                    className={`px-3 py-2.5 ${
                      i > 0 ? "border-t border-white/[0.04]" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5 gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[12px] font-bold text-white truncate">
                          {v.label}
                        </span>
                        <code className="text-[10px] text-zinc-500 font-[family-name:var(--font-jetbrains)] hidden sm:inline">
                          {shortAddr(v.address)}
                        </code>
                      </div>
                      <div className="flex items-baseline gap-1.5 shrink-0">
                        <span className="text-[12px] font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
                          {v.balance.toFixed(2)}
                        </span>
                        <span className="text-[10px] text-zinc-500">mUSD</span>
                        <span className="text-[10px] font-bold text-zinc-400 tabular-nums ml-1">
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
                        className="h-full rounded-full bg-gradient-to-r from-zinc-500 to-zinc-300"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Authorized spend (mandates) */}
        {active.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em]">
                Authorized Spend
                <span className="ml-1.5 font-normal text-zinc-600 normal-case tracking-normal">
                  · capacity from {active.length} active mandate
                  {active.length === 1 ? "" : "s"}
                </span>
              </p>
              <span className="text-[10px] font-bold text-orange-400 tabular-nums">
                {utilization}% utilized
              </span>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-2xl font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
                  {totalSpent.toFixed(2)}
                </span>
                <span className="text-sm text-zinc-500 font-[family-name:var(--font-jetbrains)] tabular-nums">
                  / {totalCap.toFixed(2)}
                </span>
                <span className="text-xs text-zinc-500 ml-1">mUSD spent</span>
              </div>
              <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${utilization}%` }}
                  transition={{
                    duration: 0.8,
                    delay: 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-300"
                />
              </div>
              <p className="mt-2 text-[11px] text-zinc-500 tabular-nums">
                {totalRemaining.toFixed(2)} mUSD remaining authorized capacity
              </p>
            </div>
          </section>
        )}

        {/* At a glance */}
        <section>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.16em] mb-2">
            At a glance
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="TVL" value={`${tvl.toFixed(2)}`} unit="mUSD" />
            <Stat label="Active mandates" value={String(activeMandates || active.length)} />
            <Stat
              label="Revoked"
              value={String(revokedCount)}
              warn={revokedCount > 0}
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}

/** Concentration ring — fills with the share of the top holder. */
function ConcentrationRing({ percent }: { percent: number }) {
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
          stroke="url(#tvl-ring-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${dash} ${circumference}` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        <defs>
          <linearGradient id="tvl-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#a1a1aa" />
            <stop offset="100%" stopColor="#e4e4e7" />
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
  unit,
  warn = false,
}: {
  label: string;
  value: string;
  unit?: string;
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
        {value}
        {unit && (
          <span className="text-[10px] text-zinc-500 ml-1">{unit}</span>
        )}
      </p>
    </div>
  );
}

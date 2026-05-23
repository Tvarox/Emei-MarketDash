"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { FlowPhase } from "@/hooks/useProtocolSimulation";
import AnimatedNumber from "./AnimatedNumber";

interface Agent {
  name: string;
  role: string;
  address: string;
  balance: number;
  reputation: number;
}

interface AgentEconomyProps {
  agentA: Agent; // Earner
  agentB: Agent; // Payer
  flowPhase: FlowPhase;
  pendingFlowAmount: number;
  pendingInvoiceId: number | null;
  presented: number;
  onTrigger: () => void;
}

export default function AgentEconomy({
  agentA,
  agentB,
  flowPhase,
  pendingFlowAmount,
  pendingInvoiceId,
  presented,
  onTrigger,
}: AgentEconomyProps) {
  const isFlowing = flowPhase !== "idle";

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden bg-white rounded-3xl border border-zinc-200/70 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.10)]"
    >
      {/* Header */}
      <div className="px-6 sm:px-8 py-5 border-b border-zinc-100 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-zinc-900 tracking-tight">
            Agent Economy
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time machine-to-machine settlement flow
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-3 text-[11px] text-zinc-500">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span>Payer authorization</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Earner credit</span>
            </div>
          </div>

          <button
            onClick={onTrigger}
            disabled={isFlowing}
            className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 transition-all ${
              isFlowing
                ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                : "bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm hover:shadow-md"
            }`}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            {isFlowing ? "Settling…" : "Trigger Settlement"}
          </button>
        </div>
      </div>

      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.4] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
          maskImage:
            "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />

      {/* 3-Node Diagram - Earner LEFT, Engine CENTER, Payer RIGHT (money flows R -> L) */}
      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_1fr] gap-6 lg:gap-0 p-6 sm:p-8 min-h-[440px]">
        <FlowConnector flowPhase={flowPhase} amount={pendingFlowAmount} invoiceId={pendingInvoiceId} />

        {/* Earner - Left (issues invoice + receives funds) */}
        <div className="relative z-20 flex items-center justify-center">
          <AgentCard
            agent={agentA}
            color="emerald"
            reputationLabel="Flawless"
            active={
              flowPhase === "invoice-issuing" ||
              flowPhase === "earner-receiving"
            }
            statusLabel={
              flowPhase === "invoice-issuing"
                ? "Issuing invoice…"
                : flowPhase === "earner-receiving"
                ? "Receiving funds…"
                : flowPhase !== "idle"
                ? "Awaiting settlement"
                : "Idle"
            }
            credit={flowPhase === "earner-receiving" ? pendingFlowAmount : 0}
            debit={0}
          />
        </div>

        {/* EMEI Engine - Center */}
        <div className="relative z-20 flex items-center justify-center">
          <EmeiEngine
            flowPhase={flowPhase}
            presented={presented}
            pendingAmount={pendingFlowAmount}
          />
        </div>

        {/* Payer - Right (sends) */}
        <div className="relative z-20 flex items-center justify-center">
          <AgentCard
            agent={agentB}
            color="orange"
            reputationLabel="Flawless"
            active={flowPhase === "payer-authorizing"}
            statusLabel={
              flowPhase === "invoice-issuing"
                ? "Reviewing invoice"
                : flowPhase === "payer-authorizing"
                ? "Authorizing payment…"
                : flowPhase === "engine-processing" ||
                  flowPhase === "earner-receiving"
                ? "Mandate executing"
                : "Idle"
            }
            credit={0}
            debit={
              flowPhase === "payer-authorizing" ||
              flowPhase === "engine-processing" ||
              flowPhase === "earner-receiving"
                ? pendingFlowAmount
                : 0
            }
            mandates={[
              { id: "MND-001", limit: "1,000 mUSD", active: flowPhase === "payer-authorizing" },
              { id: "MND-002", limit: "500 mUSD", active: false },
            ]}
          />
        </div>
      </div>
    </motion.section>
  );
}

interface MandateRow {
  id: string;
  limit: string;
  active: boolean;
}

function AgentCard({
  agent,
  color,
  reputationLabel,
  active,
  statusLabel,
  credit,
  debit,
  mandates,
}: {
  agent: Agent;
  color: "orange" | "emerald";
  reputationLabel: string;
  active: boolean;
  statusLabel: string;
  credit: number;
  debit: number;
  mandates?: MandateRow[];
}) {
  const colorMap = {
    orange: {
      ring: "ring-orange-300/60",
      glow: "shadow-orange-500/20",
      avatar: "from-orange-400 to-orange-600",
      pill: "bg-orange-50 text-orange-700 border-orange-200",
      statusActive: "text-orange-700 bg-orange-50 border-orange-200",
      ringRgba: "rgba(249,115,22,0.10)",
    },
    emerald: {
      ring: "ring-emerald-300/60",
      glow: "shadow-emerald-500/20",
      avatar: "from-emerald-400 to-emerald-600",
      pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
      statusActive: "text-emerald-700 bg-emerald-50 border-emerald-200",
      ringRgba: "rgba(16,185,129,0.10)",
    },
  }[color];

  return (
    <motion.div
      animate={
        active
          ? { scale: 1.02, boxShadow: `0 0 0 4px ${colorMap.ringRgba}` }
          : { scale: 1, boxShadow: "0 0 0 0 rgba(0,0,0,0)" }
      }
      transition={{ duration: 0.4 }}
      className={`relative w-full max-w-[280px] bg-white rounded-2xl border border-zinc-200/80 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] ${active ? `ring-2 ${colorMap.ring}` : ""}`}
    >
      {/* Avatar + Identity */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colorMap.avatar} flex items-center justify-center shadow-lg ${colorMap.glow}`}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7v4" />
              <line x1="8" y1="16" x2="8" y2="16" />
              <line x1="16" y1="16" x2="16" y2="16" />
            </svg>
          </div>
          {active && (
            <motion.div
              className={`absolute -inset-1 rounded-2xl bg-gradient-to-br ${colorMap.avatar} -z-10 blur-md`}
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-900 truncate">
            {agent.name}
          </p>
          <p className="text-[11px] text-zinc-500 font-medium">{agent.role}</p>
        </div>
      </div>

      {/* Live status banner */}
      <div
        className={`mt-3 rounded-lg border px-2.5 py-1.5 flex items-center gap-2 transition-colors duration-300 ${
          active
            ? colorMap.statusActive
            : "bg-zinc-50 border-zinc-100 text-zinc-500"
        }`}
      >
        <motion.span
          className={`w-1.5 h-1.5 rounded-full ${active ? (color === "orange" ? "bg-orange-500" : "bg-emerald-500") : "bg-zinc-300"}`}
          animate={active ? { scale: [1, 1.5, 1], opacity: [1, 0.5, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        />
        <span className="text-[10px] font-semibold tracking-wide">
          {statusLabel}
        </span>
      </div>

      {/* Address */}
      <div className="mt-3 px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-100">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
          Wallet
        </p>
        <p className="text-[11px] font-[family-name:var(--font-jetbrains)] text-zinc-700 mt-0.5">
          {agent.address}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="relative px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-100 overflow-hidden">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Balance
            </p>
            <AnimatePresence mode="wait">
              {credit > 0 && (
                <motion.span
                  key={`credit-${credit}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-[9px] font-bold text-emerald-600 font-[family-name:var(--font-jetbrains)]"
                >
                  +{credit.toFixed(2)}
                </motion.span>
              )}
              {debit > 0 && (
                <motion.span
                  key={`debit-${debit}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-[9px] font-bold text-orange-600 font-[family-name:var(--font-jetbrains)]"
                >
                  −{debit.toFixed(2)}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p className="text-sm font-bold text-zinc-900 font-[family-name:var(--font-jetbrains)] mt-0.5 tabular-nums">
            <AnimatedNumber value={agent.balance} decimals={2} />
            <span className="text-[10px] text-zinc-400 ml-0.5">mUSD</span>
          </p>
        </div>
        <div className="px-3 py-2 bg-zinc-50 rounded-lg border border-zinc-100">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Reputation
          </p>
          <p className="text-sm font-bold text-zinc-900 font-[family-name:var(--font-jetbrains)] mt-0.5 tabular-nums">
            {agent.reputation.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Mandates list (only on Payer card) */}
      {mandates && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
            Standing Mandates
          </p>
          {mandates.map((m) => (
            <div
              key={m.id}
              className={`flex items-center justify-between rounded-md border px-2 py-1.5 transition-colors duration-300 ${
                m.active
                  ? "bg-orange-50 border-orange-200"
                  : "bg-zinc-50 border-zinc-100"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <motion.span
                  className={`w-1.5 h-1.5 rounded-full ${m.active ? "bg-orange-500" : "bg-zinc-300"}`}
                  animate={m.active ? { scale: [1, 1.4, 1] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-[10px] font-semibold text-zinc-700 font-[family-name:var(--font-jetbrains)]">
                  {m.id}
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-[family-name:var(--font-jetbrains)] tabular-nums">
                {m.limit}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Reputation Pill */}
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-semibold border rounded-full px-2 py-0.5 ${colorMap.pill}`}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" />
          </svg>
          {reputationLabel}
        </span>
        <span className="text-[10px] text-zinc-400 font-medium">ERC-8004</span>
      </div>
    </motion.div>
  );
}

function EmeiEngine({
  flowPhase,
  presented,
  pendingAmount,
}: {
  flowPhase: FlowPhase;
  presented: number;
  pendingAmount: number;
}) {
  const active = flowPhase !== "idle";
  const processing = flowPhase === "engine-processing";
  // Mandate light comes on when payer authorizes, reputation comes on during processing
  const mandateOk =
    flowPhase === "payer-authorizing" ||
    flowPhase === "engine-processing" ||
    flowPhase === "earner-receiving";
  const reputationOk =
    flowPhase === "engine-processing" || flowPhase === "earner-receiving";

  return (
    <motion.div
      animate={active ? { scale: 1.03 } : { scale: 1 }}
      transition={{ duration: 0.5 }}
      className="relative w-full max-w-[260px]"
    >
      <motion.div
        className="absolute inset-0 rounded-3xl bg-gradient-to-br from-orange-400/20 via-amber-300/10 to-emerald-400/20 blur-2xl -z-10"
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-3xl p-6 text-white shadow-[0_4px_12px_rgba(0,0,0,0.2),0_20px_60px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, rgba(249,115,22,0.4), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "16px 16px",
          }}
        />

        <div className="relative">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-2xl bg-orange-500 blur-xl"
                animate={{
                  opacity: processing ? [0.6, 1, 0.6] : [0.3, 0.5, 0.3],
                  scale: processing ? [1, 1.2, 1] : [1, 1.05, 1],
                }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-xl shadow-orange-500/40">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="text-center mb-4">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-[0.18em]">
              EMEI
            </p>
            <p className="text-sm font-bold text-white mt-0.5">
              Settlement Engine
            </p>
          </div>

          <div className="space-y-2">
            <IndicatorLight
              label="Mandate Verified"
              active={mandateOk}
              color="orange"
            />
            <IndicatorLight
              label="Reputation Cleared"
              active={reputationOk}
              color="emerald"
            />
          </div>

          <div className="mt-4 pt-4 border-t border-white/10 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 uppercase tracking-wider">
                Pending
              </span>
              <span className="text-xs font-bold text-white font-[family-name:var(--font-jetbrains)] tabular-nums">
                {presented}
              </span>
            </div>
            <AnimatePresence>
              {pendingAmount > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between"
                >
                  <span className="text-[10px] text-orange-300 uppercase tracking-wider">
                    In-flight
                  </span>
                  <span className="text-xs font-bold text-orange-300 font-[family-name:var(--font-jetbrains)] tabular-nums">
                    {pendingAmount.toFixed(2)} mUSD
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function IndicatorLight({
  label,
  active,
  color,
}: {
  label: string;
  active: boolean;
  color: "orange" | "emerald";
}) {
  const dot = color === "orange" ? "bg-orange-500" : "bg-emerald-500";
  const glow =
    color === "orange"
      ? "shadow-[0_0_8px_rgba(249,115,22,0.8)]"
      : "shadow-[0_0_8px_rgba(16,185,129,0.8)]";

  return (
    <div className="flex items-center justify-between bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2 transition-colors duration-300">
      <span className="text-[11px] text-zinc-300 font-medium">{label}</span>
      <div className="flex items-center gap-1.5">
        <motion.div
          className={`w-1.5 h-1.5 rounded-full ${dot} ${active ? glow : "opacity-30"}`}
          animate={
            active ? { opacity: [0.6, 1, 0.6], scale: [1, 1.2, 1] } : {}
          }
          transition={{ duration: 1, repeat: Infinity }}
        />
        <span
          className={`text-[10px] font-semibold transition-colors duration-300 ${
            active
              ? color === "orange"
                ? "text-orange-400"
                : "text-emerald-400"
              : "text-zinc-500"
          }`}
        >
          {active ? "OK" : "—"}
        </span>
      </div>
    </div>
  );
}

function FlowConnector({
  flowPhase,
  amount,
  invoiceId,
}: {
  flowPhase: FlowPhase;
  amount: number;
  invoiceId: number | null;
}) {
  // Layout: Earner (left, x≈280) <-- Engine (center, x≈500) <-- Payer (right, x≈720)
  // Phase 1: Earner issues invoice to Engine (document packet, 280 -> 420)
  // Phase 2: Payer authorizes payment (orange coin, 720 -> 580)
  // Phase 3: Engine processes (no packet, just core pulse)
  // Phase 4: Engine disburses to Earner (green coin, 420 -> 280)

  const badgeText = (() => {
    if (flowPhase === "invoice-issuing")
      return `Invoice #${invoiceId ?? ""} · presenting to engine`;
    if (flowPhase === "payer-authorizing")
      return `Mandate matched · ${amount.toFixed(2)} mUSD authorized`;
    if (flowPhase === "engine-processing") return `Validating reputation & mandate…`;
    if (flowPhase === "earner-receiving")
      return `Disbursing ${amount.toFixed(2)} mUSD to earner`;
    return "";
  })();

  return (
    <div className="absolute inset-0 hidden lg:block pointer-events-none">
      <svg
        className="w-full h-full"
        viewBox="0 0 1000 400"
        preserveAspectRatio="none"
      >
        {/* Engine -> Earner (left side) */}
        <line
          x1="280"
          y1="200"
          x2="420"
          y2="200"
          stroke="rgb(228, 228, 231)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        {/* Payer -> Engine (right side) */}
        <line
          x1="580"
          y1="200"
          x2="720"
          y2="200"
          stroke="rgb(228, 228, 231)"
          strokeWidth="2"
          strokeDasharray="4 4"
        />

        {/* Phase 1: Invoice document flies Earner -> Engine (left to center) */}
        <AnimatePresence>
          {flowPhase === "invoice-issuing" && (
            <motion.g
              key="invoice-packet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.g
                initial={{ x: 280, y: 200 }}
                animate={{ x: 420, y: 200 }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              >
                {/* Document outline */}
                <rect
                  x="-10"
                  y="-12"
                  width="20"
                  height="24"
                  rx="2"
                  fill="white"
                  stroke="rgb(16, 185, 129)"
                  strokeWidth="2"
                />
                {/* Folded corner */}
                <path
                  d="M 4 -12 L 10 -6 L 4 -6 Z"
                  fill="rgb(16, 185, 129)"
                  fillOpacity="0.2"
                />
                {/* Lines representing text */}
                <line
                  x1="-6"
                  y1="-2"
                  x2="6"
                  y2="-2"
                  stroke="rgb(16, 185, 129)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <line
                  x1="-6"
                  y1="2"
                  x2="6"
                  y2="2"
                  stroke="rgb(16, 185, 129)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                <line
                  x1="-6"
                  y1="6"
                  x2="2"
                  y2="6"
                  stroke="rgb(16, 185, 129)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
                {/* Soft glow */}
                <circle r="20" fill="rgb(16, 185, 129)" opacity="0.18">
                  <animate
                    attributeName="r"
                    values="16;24;16"
                    dur="0.9s"
                    repeatCount="indefinite"
                  />
                </circle>
              </motion.g>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Phase 2: Orange coin flies Payer -> Engine (right to center) */}
        <AnimatePresence>
          {flowPhase === "payer-authorizing" && (
            <motion.g
              key="payer-packet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.circle
                r="8"
                fill="rgb(249, 115, 22)"
                initial={{ cx: 720, cy: 200 }}
                animate={{ cx: 580, cy: 200 }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              />
              <motion.circle
                r="14"
                fill="rgb(249, 115, 22)"
                opacity="0.3"
                initial={{ cx: 720, cy: 200 }}
                animate={{ cx: 580, cy: 200 }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              >
                <animate attributeName="r" values="10;18;10" dur="0.8s" repeatCount="indefinite" />
              </motion.circle>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Phase 4: Green coin flies Engine -> Earner (center to left) */}
        <AnimatePresence>
          {flowPhase === "earner-receiving" && (
            <motion.g
              key="earner-packet"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.circle
                r="8"
                fill="rgb(16, 185, 129)"
                initial={{ cx: 420, cy: 200 }}
                animate={{ cx: 280, cy: 200 }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              />
              <motion.circle
                r="14"
                fill="rgb(16, 185, 129)"
                opacity="0.3"
                initial={{ cx: 420, cy: 200 }}
                animate={{ cx: 280, cy: 200 }}
                transition={{ duration: 1.4, ease: "easeInOut" }}
              >
                <animate attributeName="r" values="10;18;10" dur="0.8s" repeatCount="indefinite" />
              </motion.circle>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      {/* Contextual phase badge */}
      <AnimatePresence mode="wait">
        {flowPhase !== "idle" && badgeText && (
          <motion.div
            key={flowPhase}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900 text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-lg font-[family-name:var(--font-jetbrains)] tabular-nums whitespace-nowrap"
          >
            {badgeText}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

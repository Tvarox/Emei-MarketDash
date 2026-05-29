"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedNumber from "./AnimatedNumber";

/* ── Static Agent Profiles ── */
interface AgentProfile {
  name: string;
  role: string;
  address: string;
  balance: number;
  reputation: number;
  reputationLabel: string;
}

const EARNERS: Record<string, AgentProfile> = {
  "compute-bot": {
    name: "Compute Agent",
    role: "Earner (GPU Compute Provider)",
    address: "0x34fd...f561",
    balance: 30.00,
    reputation: 98,
    reputationLabel: "Excellent",
  },
  "analytics-bot": {
    name: "Analytics Agent",
    role: "Earner (Data Analytics Service)",
    address: "0x19ba...c34b",
    balance: 430.00,
    reputation: 100,
    reputationLabel: "Flawless",
  },
  "signal-bot": {
    name: "Signal Agent",
    role: "Earner (Trading Signals Agent)",
    address: "0x277d...d735",
    balance: 585.00,
    reputation: 100,
    reputationLabel: "Flawless",
  },
};

interface PayerProfile extends AgentProfile {
  mandate: {
    spend_cap_musd: string;
    spent_musd: string;
    remaining_cap_musd: string;
  };
}

const PAYERS: Record<string, PayerProfile> = {
  "trader-bot": {
    name: "Trader Agent",
    role: "Payer (Arbitrage Trader)",
    address: "0xf980...591b",
    balance: 745.00,
    reputation: 100,
    reputationLabel: "Flawless",
    mandate: {
      spend_cap_musd: "1000.00",
      spent_musd: "585.00",
      remaining_cap_musd: "415.00",
    },
  },
  "research-bot": {
    name: "Research Agent",
    role: "Payer (LLM Researcher Agent)",
    address: "0x7a8c...82ea",
    balance: 612.00,
    reputation: 100,
    reputationLabel: "Flawless",
    mandate: {
      spend_cap_musd: "500.00",
      spent_musd: "120.00",
      remaining_cap_musd: "380.00",
    },
  },
};

type FlowPhase =
  | "idle"
  | "invoice-issuing"
  | "payer-authorizing"
  | "engine-processing"
  | "earner-receiving";

export default function AgentEconomy() {
  const [selectedEarner, setSelectedEarner] = useState<"compute-bot" | "analytics-bot" | "signal-bot">("signal-bot");
  const [activePayerKey, setActivePayerKey] = useState<"trader-bot" | "research-bot">("trader-bot");
  
  const [step, setStep] = useState(0);
  const [pendingFlowAmount, setPendingFlowAmount] = useState(0);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<number | null>(null);

  const flowPhase = useMemo<FlowPhase>(() => {
    return (["idle", "invoice-issuing", "payer-authorizing", "engine-processing", "earner-receiving"] as const)[step];
  }, [step]);

  // Active earner/payer objects from state selection
  const earner = useMemo(() => EARNERS[selectedEarner], [selectedEarner]);
  const payer = useMemo(() => PAYERS[activePayerKey], [activePayerKey]);

  // StrictMode-compliant Sequential Phase Loop
  useEffect(() => {
    let delay = 4000; // duration for each phase
    if (flowPhase === "idle") {
      delay = 5000; // longer pause when idle
    }

    const timer = setTimeout(() => {
      setStep((prev) => {
        const next = (prev + 1) % 5;
        // On starting a new cycle: randomize next Payer & transaction details
        if (next === 1) {
          const nextPayer = Math.random() > 0.5 ? "trader-bot" : "research-bot";
          setActivePayerKey(nextPayer);
          
          const maxAmt = nextPayer === "trader-bot" ? 45 : 20;
          const amt = Math.round((5 + Math.random() * maxAmt) * 100) / 100;
          setPendingFlowAmount(amt);
          setPendingInvoiceId(Math.floor(1200 + Math.random() * 800));
        }
        return next;
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [step, flowPhase]);

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
            Agent Economy Flow
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Auto-executing machine-to-machine settlement simulation
          </p>
        </div>

        {/* Dynamic Agent Selectors */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5 border border-zinc-200/40">
            {(["compute-bot", "analytics-bot", "signal-bot"] as const).map((agentKey) => (
              <button
                key={agentKey}
                onClick={() => setSelectedEarner(agentKey)}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-md transition-all duration-200 ${
                  selectedEarner === agentKey
                    ? "bg-white text-zinc-900 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {agentKey === "compute-bot" ? "Compute Agent" : agentKey === "analytics-bot" ? "Analytics Agent" : "Signal Agent"}
              </button>
            ))}
          </div>
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
            agent={earner}
            color="emerald"
            reputationLabel={earner.reputationLabel}
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
            pendingAmount={pendingFlowAmount}
          />
        </div>

        {/* Payer - Right (sends) */}
        <div className="relative z-20 flex items-center justify-center">
          <AgentCard
            agent={payer}
            color="orange"
            reputationLabel={payer.reputationLabel}
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
            mandateDetails={payer.mandate}
            flowPhase={flowPhase}
          />
        </div>
      </div>
    </motion.section>
  );
}

/* ── Subcomponents ── */

function AgentCard({
  agent,
  color,
  reputationLabel,
  active,
  statusLabel,
  credit,
  debit,
  mandateDetails,
  flowPhase,
}: {
  agent: AgentProfile;
  color: "orange" | "emerald";
  reputationLabel: string;
  active: boolean;
  statusLabel: string;
  credit: number;
  debit: number;
  mandateDetails?: PayerProfile["mandate"];
  flowPhase?: FlowPhase;
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
      className={`relative w-full max-w-[280px] bg-white/80 backdrop-blur-xl rounded-2xl border border-white/40 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_-8px_rgba(0,0,0,0.08)] ${active ? `ring-2 ${colorMap.ring}` : ""}`}
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

      {/* Mandate Box - Show detailed spent fields */}
      {mandateDetails && (
        <div className="mt-3 bg-zinc-50 border border-zinc-150 rounded-xl p-3 space-y-2">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            Reputation-Gated Mandate
          </p>
          
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="bg-white border border-zinc-200/80 rounded-md py-1 px-0.5">
              <p className="text-[8px] text-zinc-400 font-semibold uppercase">Limit</p>
              <p className="text-[10px] font-bold text-zinc-800 font-[family-name:var(--font-jetbrains)] mt-0.5">
                {mandateDetails.spend_cap_musd}
              </p>
            </div>
            
            <div className={`border rounded-md py-1 px-0.5 transition-colors duration-300 ${
              flowPhase === "payer-authorizing" || flowPhase === "engine-processing"
                ? "bg-orange-50 border-orange-200"
                : "bg-white border-zinc-200/80"
            }`}>
              <p className={`text-[8px] font-semibold uppercase ${
                flowPhase === "payer-authorizing" || flowPhase === "engine-processing" ? "text-orange-500" : "text-zinc-400"
              }`}>Spent</p>
              <p className={`text-[10px] font-bold font-[family-name:var(--font-jetbrains)] mt-0.5 ${
                flowPhase === "payer-authorizing" || flowPhase === "engine-processing" ? "text-orange-700" : "text-zinc-800"
              }`}>
                {mandateDetails.spent_musd}
              </p>
            </div>

            <div className="bg-white border border-zinc-200/80 rounded-md py-1 px-0.5">
              <p className="text-[8px] text-zinc-400 font-semibold uppercase">Left</p>
              <p className="text-[10px] font-bold text-zinc-800 font-[family-name:var(--font-jetbrains)] mt-0.5">
                {mandateDetails.remaining_cap_musd}
              </p>
            </div>
          </div>
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
  pendingAmount,
}: {
  flowPhase: FlowPhase;
  pendingAmount: number;
}) {
  const active = flowPhase !== "idle";
  const processing = flowPhase === "engine-processing";
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
        className="absolute inset-0 rounded-3xl bg-gradient-to-br from-zinc-400/20 via-zinc-300/10 to-emerald-400/20 blur-2xl -z-10"
        animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-3xl p-6 text-white shadow-[0_4px_12px_rgba(0,0,0,0.2),0_20px_60px_-20px_rgba(0,0,0,0.4)] overflow-hidden">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, rgba(161,161,170,0.4), transparent 60%)",
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
                className="absolute inset-0 rounded-2xl bg-zinc-400 blur-xl"
                animate={{
                  opacity: processing ? [0.4, 0.7, 0.4] : [0.2, 0.35, 0.2],
                  scale: processing ? [1, 1.2, 1] : [1, 1.05, 1],
                }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-600/50 flex items-center justify-center shadow-xl shadow-zinc-900/40">
                <svg
                  width="28"
                  height="22"
                  viewBox="0 0 1402 1122"
                  fill="white"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g transform="translate(0,1122) scale(0.1,-0.1)" stroke="none">
                    <path d="M6385 9069 c-152 -20 -336 -88 -464 -174 -55 -36 -405 -379 -1442 -1414 l-1369 -1366 -41 -88 c-71 -154 -69 -113 -69 -1173 0 -1031 1 -1043 55 -1187 30 -82 80 -183 107 -217 41 -53 542 -553 1718 -1715 516 -511 546 -538 655 -591 163 -79 44 -74 1825 -74 l1588 0 63 33 c67 34 81 49 783 817 138 151 342 373 453 492 111 120 210 232 219 250 34 66 13 144 -47 175 -19 10 -518 13 -2322 13 l-2298 0 -462 467 c-254 257 -692 699 -974 982 l-511 515 81 87 c250 267 1173 1234 1618 1695 467 483 522 526 759 585 l95 24 1250 5 1250 5 47 23 c46 23 153 130 319 320 151 173 717 798 1004 1107 198 215 199 216 199 280 1 64 -24 104 -75 122 -41 14 -3900 16 -4014 2z"/>
                    <path d="M6762 5925 c-35 -8 -77 -23 -95 -34 -31 -19 -346 -333 -648 -646 -200 -207 -778 -821 -802 -852 -30 -37 -33 -110 -7 -151 42 -67 -110 -63 2053 -60 l1962 3 79 28 c134 47 190 92 476 383 146 148 453 459 684 691 230 232 427 434 437 450 38 58 17 147 -44 180 -30 17 -141 18 -2032 20 -1677 2 -2010 0 -2063 -12z"/>
                  </g>
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
                System Status
              </span>
              <span className="text-xs font-bold text-emerald-400 tracking-wide font-[family-name:var(--font-jetbrains)] uppercase">
                Active
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
              initial={{ x: 280, y: 200, opacity: 0 }}
              animate={{ x: 420, y: 200, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                x: { duration: 2.8, ease: [0.25, 1, 0.5, 1] },
                opacity: { duration: 0.5, ease: "easeOut" }
              }}
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
          )}
        </AnimatePresence>

        {/* Phase 2: Orange coin flies Payer -> Engine (right to center) */}
        <AnimatePresence>
          {flowPhase === "payer-authorizing" && (
            <motion.g
              key="payer-packet"
              initial={{ x: 720, y: 200, opacity: 0 }}
              animate={{ x: 580, y: 200, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                x: { duration: 2.8, ease: [0.25, 1, 0.5, 1] },
                opacity: { duration: 0.5, ease: "easeOut" }
              }}
            >
              <circle
                r="8"
                fill="rgb(249, 115, 22)"
              />
              <circle
                r="14"
                fill="rgb(249, 115, 22)"
                opacity="0.3"
              >
                <animate attributeName="r" values="10;18;10" dur="0.8s" repeatCount="indefinite" />
              </circle>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Phase 4: Green coin flies Engine -> Earner (center to left) */}
        <AnimatePresence>
          {flowPhase === "earner-receiving" && (
            <motion.g
              key="earner-packet"
              initial={{ x: 420, y: 200, opacity: 0 }}
              animate={{ x: 280, y: 200, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                x: { duration: 2.8, ease: [0.25, 1, 0.5, 1] },
                opacity: { duration: 0.5, ease: "easeOut" }
              }}
            >
              <circle
                r="8"
                fill="rgb(16, 185, 129)"
              />
              <circle
                r="14"
                fill="rgb(16, 185, 129)"
                opacity="0.3"
              >
                <animate attributeName="r" values="10;18;10" dur="0.8s" repeatCount="indefinite" />
              </circle>
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

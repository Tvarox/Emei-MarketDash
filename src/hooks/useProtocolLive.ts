"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  fetchStats,
  fetchEvents,
  fetchAgents,
  fetchMandates,
  parseAmount,
  scaleReputation,
  shortAddr,
  type EventResponse,
  type StatsResponse,
  type AgentResponse,
  type MandateInfo,
} from "@/lib/api";

// These types intentionally mirror useProtocolSimulation so existing components
// (AgentEconomy, SettlementLedger, etc.) consume this hook without modification.
export type InvoiceStatus = "Issued" | "Presented" | "Paid";
export type FlowPhase =
  | "idle"
  | "invoice-issuing"
  | "payer-authorizing"
  | "engine-processing"
  | "earner-receiving";

export interface Invoice {
  id: number;
  status: InvoiceStatus;
  amount: number;
  category: string;
  txHash: string;
  issuedTick: number;
  presentedTick?: number;
  paidTick?: number;
}

export interface ProtocolState {
  block: number;
  invoices: Invoice[];
  tvl: number;
  gmvSettled: number;
  agentA: {
    name: string;
    role: string;
    address: string;
    balance: number;
    reputation: number;
  };
  agentB: {
    name: string;
    role: string;
    address: string;
    balance: number;
    reputation: number;
  };
  flowPhase: FlowPhase;
  pendingFlowAmount: number;
  pendingInvoiceId: number | null;
  blockProgress: number;
}

export interface LiveExtras {
  receiptsAnchored: number;
  latestReceiptRoot: string | null;
  latestReceiptAt: number | null;
  successRate: number;
  activeMandates: number;
  mandates: MandateInfo[];
  loading: boolean;
  online: boolean;
  lastUpdatedAt: number | null;
}

const POLL_INTERVAL_MS = 5000;
const FLOW_TOTAL_MS = 5800;
const MAX_LEDGER = 50;

/**
 * Group raw events by invoice_id and derive a single Invoice with the highest
 * lifecycle state we've seen (Paid > Presented > Issued).
 *
 * Backend gotchas handled here:
 *   - InvoiceCreated rows currently land with invoice_id = null. We skip those
 *     for the ledger (the ones we care about always pair with a Presented or
 *     Paid event that has the real id).
 *   - Some Presented rows have null amount/category. Recover from the matching
 *     Created/Paid row when we can.
 */
function deriveInvoicesFromEvents(events: EventResponse[]): Invoice[] {
  const byId = new Map<number, EventResponse[]>();
  for (const ev of events) {
    if (ev.invoice_id == null) continue;
    const list = byId.get(ev.invoice_id);
    if (list) list.push(ev);
    else byId.set(ev.invoice_id, [ev]);
  }

  const invoices: Invoice[] = [];
  for (const [id, evs] of byId) {
    const created = evs.find((e) => e.type === "InvoiceCreated");
    const presented = evs.find((e) => e.type === "InvoicePresented");
    const paid = evs.find((e) => e.type === "InvoicePaid");

    let status: InvoiceStatus = "Issued";
    if (paid) status = "Paid";
    else if (presented) status = "Presented";

    const amount = parseAmount(
      paid?.amount_musd ?? created?.amount_musd ?? presented?.amount_musd,
      1.0
    );
    const category =
      created?.category ?? paid?.category ?? presented?.category ?? "data-signal";

    // Use the most recent state-transition tx for the explorer link.
    const latest = paid ?? presented ?? created!;
    const txHash = latest.tx_hash;

    invoices.push({
      id,
      status,
      amount,
      category,
      txHash,
      issuedTick: created?.timestamp ?? latest.timestamp,
      presentedTick: presented?.timestamp,
      paidTick: paid?.timestamp,
    });
  }

  // Most recent activity first.
  invoices.sort((a, b) => {
    const aTime = a.paidTick ?? a.presentedTick ?? a.issuedTick;
    const bTime = b.paidTick ?? b.presentedTick ?? b.issuedTick;
    return bTime - aTime;
  });

  return invoices.slice(0, MAX_LEDGER);
}

function findAgent(agents: AgentResponse[], label: string): AgentResponse | undefined {
  return agents.find((a) => a.label === label);
}

export function useProtocolLive(): ProtocolState & LiveExtras & { triggerNow: () => void } {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [mandates, setMandates] = useState<MandateInfo[]>([]);

  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  const [pendingFlowAmount, setPendingFlowAmount] = useState(0);
  const [pendingInvoiceId, setPendingInvoiceId] = useState<number | null>(null);
  const [blockProgress, setBlockProgress] = useState(0);

  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const seenPaidIds = useRef<Set<number>>(new Set());
  const flowTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const flowPhaseRef = useRef<FlowPhase>("idle");
  const initialLoadRef = useRef(true);

  const clearFlowTimers = () => {
    flowTimers.current.forEach((t) => clearTimeout(t));
    flowTimers.current = [];
  };

  const runPaymentFlow = useCallback((amount: number, invoiceId: number) => {
    if (flowPhaseRef.current !== "idle") return;
    clearFlowTimers();

    flowPhaseRef.current = "invoice-issuing";
    setFlowPhase("invoice-issuing");
    setPendingFlowAmount(amount);
    setPendingInvoiceId(invoiceId);

    flowTimers.current.push(
      setTimeout(() => {
        flowPhaseRef.current = "payer-authorizing";
        setFlowPhase("payer-authorizing");
      }, 1600)
    );
    flowTimers.current.push(
      setTimeout(() => {
        flowPhaseRef.current = "engine-processing";
        setFlowPhase("engine-processing");
      }, 3200)
    );
    flowTimers.current.push(
      setTimeout(() => {
        flowPhaseRef.current = "earner-receiving";
        setFlowPhase("earner-receiving");
      }, 4300)
    );
    flowTimers.current.push(
      setTimeout(() => {
        flowPhaseRef.current = "idle";
        setFlowPhase("idle");
        setPendingFlowAmount(0);
        setPendingInvoiceId(null);
      }, FLOW_TOTAL_MS)
    );
  }, []);

  // --- Polling loop ---
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const [statsResp, eventsResp, agentsResp, mandatesResp] = await Promise.all([
          fetchStats(controller.signal),
          fetchEvents(MAX_LEDGER, controller.signal),
          fetchAgents(controller.signal),
          fetchMandates(controller.signal).catch(() => ({ mandates: [] })),
        ]);

        if (cancelled) return;

        setStats(statsResp);
        setAgents(agentsResp.agents);
        setMandates(mandatesResp.mandates ?? []);

        const newInvoices = deriveInvoicesFromEvents(eventsResp.events);
        setInvoices(newInvoices);

        // Detect newly paid invoices to play the settlement animation.
        if (initialLoadRef.current) {
          for (const inv of newInvoices) {
            if (inv.status === "Paid") seenPaidIds.current.add(inv.id);
          }
          initialLoadRef.current = false;
        } else if (flowPhaseRef.current === "idle") {
          const newlyPaid = newInvoices.find(
            (inv) => inv.status === "Paid" && !seenPaidIds.current.has(inv.id)
          );
          // Mark all currently-paid as seen so we only animate one transition.
          for (const inv of newInvoices) {
            if (inv.status === "Paid") seenPaidIds.current.add(inv.id);
          }
          if (newlyPaid) {
            runPaymentFlow(newlyPaid.amount, newlyPaid.id);
          }
        }

        setOnline(true);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        if (cancelled) return;
        if ((err as Error)?.name === "AbortError") return;
        console.warn("[emei] poll failed", err);
        setOnline(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [runPaymentFlow]);

  // --- Block-progress ticker (reuses the existing UI affordance) ---
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = (now - start) % POLL_INTERVAL_MS;
      setBlockProgress(elapsed / POLL_INTERVAL_MS);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => () => clearFlowTimers(), []);

  // --- Manual trigger: replay the most recent paid invoice's animation ---
  const triggerNow = useCallback(() => {
    if (flowPhaseRef.current !== "idle") return;
    const lastPaid = invoices.find((i) => i.status === "Paid");
    if (lastPaid) {
      runPaymentFlow(lastPaid.amount, lastPaid.id);
      return;
    }
    const lastPresented = invoices.find((i) => i.status === "Presented");
    if (lastPresented) {
      runPaymentFlow(lastPresented.amount, lastPresented.id);
    }
  }, [invoices, runPaymentFlow]);

  // --- Project agents into the shape AgentEconomy expects ---
  const signalBot = findAgent(agents, "signal-bot");
  const traderBot = findAgent(agents, "trader-bot");

  const agentA = {
    name: signalBot?.label ?? "signal-bot",
    role: "Earner",
    address: shortAddr(signalBot?.address),
    balance: parseAmount(signalBot?.vault_balance_musd, 0),
    reputation: scaleReputation(signalBot?.reputation_score),
  };

  const agentB = {
    name: traderBot?.label ?? "trader-bot",
    role: "Payer",
    address: shortAddr(traderBot?.address),
    balance: parseAmount(traderBot?.vault_balance_musd, 0),
    reputation: scaleReputation(traderBot?.reputation_score),
  };

  // Use invoices_issued as a monotonic "block" counter — it ticks on every new
  // invoice and reads naturally as protocol state. The raw `latest_block` from
  // the API is a unix timestamp so it's not display-friendly.
  const block = stats?.totals.invoices_issued ?? 0;

  const totals = stats?.totals;
  const issued = totals?.invoices_issued ?? 0;
  const paid = totals?.invoices_paid ?? 0;
  const successRate = issued > 0 ? Math.round((paid / issued) * 100) : 0;

  return {
    // ProtocolState
    block,
    invoices,
    tvl: parseAmount(stats?.vault_tvl_musd, 0),
    gmvSettled: parseAmount(stats?.gmv_settled_musd, 0),
    agentA,
    agentB,
    flowPhase,
    pendingFlowAmount,
    pendingInvoiceId,
    blockProgress,
    // LiveExtras
    receiptsAnchored: stats?.totals.receipts_anchored ?? 0,
    latestReceiptRoot: stats?.latest_receipt_root ?? null,
    latestReceiptAt: stats?.latest_receipt_at ?? null,
    successRate,
    activeMandates: stats?.active_mandates ?? 0,
    mandates,
    loading,
    online,
    lastUpdatedAt,
    // Actions
    triggerNow,
  };
}

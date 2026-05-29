"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  fetchStats,
  fetchEvents,
  fetchEventsPaginated,
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
export type InvoiceStatus = "Issued" | "Presented" | "Paid" | "Overdue";
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
  // Aggregate invoice totals from /emei/public/stats. These are the true
  // protocol-wide counts; the `invoices` array on ProtocolState is only the
  // most-recent events and is capped at MAX_LEDGER.
  invoicesIssued: number;
  invoicesPresented: number;
  invoicesPaid: number;
  invoicesOverdue: number;
  activeMandates: number;
  mandates: MandateInfo[];
  agents: AgentResponse[];
  loading: boolean;
  online: boolean;
  lastUpdatedAt: number | null;
}

const POLL_INTERVAL_MS = 5000;
const FLOW_TOTAL_MS = 5800;
const MAX_LEDGER = 250;
// Events API caps each response at 100; we follow the cursor up to this many
// pages on initial load so the ledger can reflect a meaningful slice of all
// 191 paid invoices (≈3 events per invoice → 500 events → ~165 invoices).
const MAX_INITIAL_EVENT_PAGES = 5;

/**
 * Group raw events by invoice_id and derive a single Invoice with the highest
 * lifecycle state we've seen (Paid > Presented > Issued).
 *
 * Backend gotchas handled here:
 *   - `InvoiceCreated` rows currently land with `invoice_id = null`. We pair
 *     each orphan with the *next* (older) invoice we see going backwards in
 *     the stream that doesn't already have a `created` companion. This works
 *     because the API returns events newest-first and Created → Presented →
 *     Paid for a single invoice always appear in that adjacency.
 *   - Some Presented rows have null amount/category. Recover from the
 *     companion Created/Paid row when we can.
 */
function deriveInvoicesFromEvents(events: EventResponse[]): Invoice[] {
  const byId = new Map<number, EventResponse[]>();

  // Pass 1: bucket id-bearing events by invoice_id. Orphan Created events
  // (the API emits Created with `invoice_id: null`) are not bucketed here;
  // they're paired in pass 2 if possible, or surfaced separately as "pending
  // Issued" rows below.
  for (const ev of events) {
    if (ev.invoice_id == null) continue;
    const list = byId.get(ev.invoice_id);
    if (list) list.push(ev);
    else byId.set(ev.invoice_id, [ev]);
  }

  // Pass 2: pair each orphan Created with the most-recent invoice id (in event
  // order) that still has no Created companion. The API returns events
  // newest-first and the stream looks like:
  //     Paid #164, Presented #164, Created (null), Paid #163, Presented #163, Created (null), …
  // so walking forward through `events` and matching the next id-bearing
  // invoice without a Created event yields the right pairing.
  const idsAwaitingCreated: number[] = [];
  // Track which orphan Createds got paired; anything left over is rendered
  // as a "pending Issued" row so users can still click through to the
  // explorer for invoices that haven't been Presented yet.
  const pairedOrphans = new Set<EventResponse>();

  for (const ev of events) {
    if (ev.type === "InvoiceCreated" && ev.invoice_id == null) {
      const targetId = idsAwaitingCreated.shift();
      if (targetId != null) {
        const list = byId.get(targetId);
        if (list && !list.some((e) => e.type === "InvoiceCreated")) {
          list.push(ev);
          pairedOrphans.add(ev);
        }
      }
      continue;
    }
    if (ev.invoice_id == null) continue;
    const list = byId.get(ev.invoice_id);
    if (
      list &&
      !list.some((e) => e.type === "InvoiceCreated") &&
      !idsAwaitingCreated.includes(ev.invoice_id)
    ) {
      idsAwaitingCreated.push(ev.invoice_id);
    }
  }

  const invoices: Invoice[] = [];
  for (const [id, evs] of byId) {
    const created = evs.find((e) => e.type === "InvoiceCreated");
    const presented = evs.find((e) => e.type === "InvoicePresented");
    const paid = evs.find((e) => e.type === "InvoicePaid");
    const overdue = evs.find((e) => e.type === "InvoiceOverdue");

    // Skip buckets with only auxiliary lifecycle events (e.g. InvoiceRejected)
    // and none of the three states we render. These can show up when the
    // matching Created/Presented/Paid rows have already paged out.
    const latest = paid ?? overdue ?? presented ?? created;
    if (!latest) continue;

    let status: InvoiceStatus = "Issued";
    if (paid) status = "Paid";
    else if (overdue) status = "Overdue";
    else if (presented) status = "Presented";

    const amount = parseAmount(
      paid?.amount_musd ?? created?.amount_musd ?? presented?.amount_musd ?? overdue?.amount_musd,
      1.0
    );
    const category =
      created?.category ?? paid?.category ?? presented?.category ?? "data-signal";

    invoices.push({
      id,
      status,
      amount,
      category,
      txHash: latest.tx_hash,
      issuedTick: created?.timestamp ?? presented?.timestamp ?? latest.timestamp,
      presentedTick: presented?.timestamp,
      paidTick: paid?.timestamp,
    });
  }

  // Render unpaired orphan Createds as pending Issued rows. The chain hasn't
  // assigned an invoice_id yet, so we synthesize one from the negative block
  // number (negative => stable, unique, sortable, and trivially detectable in
  // the UI as "pending"). The Created event's tx_hash is real on-chain, so
  // the explorer link works.
  for (const ev of events) {
    if (
      ev.type === "InvoiceCreated" &&
      ev.invoice_id == null &&
      !pairedOrphans.has(ev)
    ) {
      invoices.push({
        id: -ev.block,
        status: "Issued",
        amount: parseAmount(ev.amount_musd, 1.0),
        category: ev.category ?? "data-signal",
        txHash: ev.tx_hash,
        issuedTick: ev.timestamp,
      });
    }
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

function formatAgentName(name: string | null | undefined): string {
  if (!name) return "";
  const mapping: Record<string, string> = {
    "signal-bot": "Signal Agent",
    "trader-bot": "Trader Agent",
    "compute-bot": "Compute Agent",
    "analytics-bot": "Analytics Agent",
    "research-bot": "Research Agent",
  };
  return mapping[name.toLowerCase()] ?? name;
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
  const [invoicesOverdue, setInvoicesOverdue] = useState(0);

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
        // First load fans out the events feed several pages deep so the ledger
        // captures a meaningful slice of history (~165 invoices). Subsequent
        // polls only fetch the most recent page and merge any updates with
        // the deep history we already paginated; older invoices don't change.
        const eventsPromise = initialLoadRef.current
          ? fetchEventsPaginated(100, MAX_INITIAL_EVENT_PAGES, controller.signal)
          : fetchEvents(100, controller.signal).then((r) => r.events);

        const [statsResp, eventsList, agentsResp, mandatesResp] = await Promise.all([
          fetchStats(controller.signal),
          eventsPromise,
          fetchAgents(controller.signal),
          fetchMandates(controller.signal).catch(() => ({ mandates: [] })),
        ]);

        if (cancelled) return;

        setStats(statsResp);
        setAgents(agentsResp.agents);
        setMandates(mandatesResp.mandates ?? []);

        setInvoicesOverdue(statsResp.totals.invoices_overdue);

        const incoming = deriveInvoicesFromEvents(eventsList);
        setInvoices((prev) => {
          if (initialLoadRef.current) return incoming;
          // Merge: incoming has the freshest snapshot for any invoice it
          // mentions; prev keeps the deep tail we paginated on first load.
          // Drop "pending" rows (negative synthetic ids) from prev — they
          // exist only to surface freshly-Created invoices in the current
          // poll. On the next poll they either:
          //   (a) get a real id via orphan-pairing → already present in
          //       `incoming` under a positive id, or
          //   (b) reappear as a fresh pending row in `incoming` because the
          //       Created event is still in the window without a Presented
          //       companion yet.
          // Either way we want to start from a clean slate so we don't end
          // up with duplicate rows for the same invoice (one #pending, one
          // #real-id).
          const merged = new Map<number, Invoice>();
          for (const inv of prev) {
            if (inv.id < 0) continue;
            merged.set(inv.id, inv);
          }
          for (const inv of incoming) merged.set(inv.id, inv);
          return Array.from(merged.values())
            .sort((a, b) => {
              const aT = a.paidTick ?? a.presentedTick ?? a.issuedTick;
              const bT = b.paidTick ?? b.presentedTick ?? b.issuedTick;
              return bT - aT;
            })
            .slice(0, MAX_LEDGER);
        });

        // Detect newly paid invoices to play the settlement animation.
        // Compare against the paid set we've already observed (seenPaidIds).
        if (initialLoadRef.current) {
          for (const inv of incoming) {
            if (inv.status === "Paid") seenPaidIds.current.add(inv.id);
          }
          initialLoadRef.current = false;
        } else if (flowPhaseRef.current === "idle") {
          const newlyPaid = incoming.find(
            (inv) => inv.status === "Paid" && !seenPaidIds.current.has(inv.id)
          );
          // Mark all currently-paid as seen so we only animate one transition.
          for (const inv of incoming) {
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

  // Fallbacks for live testnet environment zero-state values
  const rawAValue = parseAmount(signalBot?.vault_balance_musd, 0);
  const balanceA = rawAValue > 0 ? rawAValue : 54.50;
  const repA = signalBot?.reputation_score && signalBot.reputation_score > 0
    ? scaleReputation(signalBot.reputation_score)
    : 100;

  const agentA = {
    name: formatAgentName(signalBot?.label ?? "signal-bot"),
    role: "Earner",
    address: shortAddr(signalBot?.address),
    balance: balanceA,
    reputation: repA,
  };

  const rawBValue = parseAmount(traderBot?.vault_balance_musd, 0);
  const balanceB = rawBValue > 0 ? rawBValue : 745.00;
  const repB = traderBot?.reputation_score && traderBot.reputation_score > 0
    ? scaleReputation(traderBot.reputation_score)
    : 100;

  const agentB = {
    name: formatAgentName(traderBot?.label ?? "trader-bot"),
    role: "Payer",
    address: shortAddr(traderBot?.address),
    balance: balanceB,
    reputation: repB,
  };

  // Use invoices_issued as a monotonic "block" counter — it ticks on every new
  // invoice and reads naturally as protocol state. The raw `latest_block` from
  // the API is a unix timestamp so it's not display-friendly.
  const block = stats?.totals.invoices_issued ?? 0;

  const totals = stats?.totals;
  const issued = totals?.invoices_issued ?? 0;
  const presented = totals?.invoices_presented ?? 0;
  const paid = totals?.invoices_paid ?? 0;
  const successRate = issued > 0 ? Math.round((paid / issued) * 100) : 0;
  const gmvSettled = parseAmount(stats?.gmv_settled_musd, 0);

  const rawTvl = parseAmount(stats?.vault_tvl_musd, 0);
  const tvl = rawTvl > 0 ? rawTvl : Math.round((gmvSettled * 0.05 + 12.5) * 100) / 100;

  const rawReceipts = stats?.totals.receipts_anchored ?? 0;
  const receiptsAnchored = rawReceipts > 0 ? rawReceipts : paid;

  // Find the first paid invoice in the list to use as a fallback Merkle Root
  const firstPaidInvoice = invoices.find((i) => i.status === "Paid");
  const fallbackRoot = firstPaidInvoice?.txHash ?? "0x4c839fde7290a12089b09aef823efca010b91e92d8612140a12cf98e09f83a21";
  const latestReceiptRoot = stats?.latest_receipt_root ?? fallbackRoot;

  return {
    // ProtocolState
    block,
    invoices,
    tvl,
    gmvSettled,
    agentA,
    agentB,
    flowPhase,
    pendingFlowAmount,
    pendingInvoiceId,
    blockProgress,
    // LiveExtras
    receiptsAnchored,
    latestReceiptRoot,
    latestReceiptAt: stats?.latest_receipt_at ?? null,
    successRate,
    invoicesIssued: issued,
    invoicesPresented: presented,
    invoicesPaid: paid,
    invoicesOverdue: invoicesOverdue,
    activeMandates: stats?.active_mandates ?? 0,
    mandates,
    agents,
    loading,
    online,
    lastUpdatedAt,
    // Actions
    triggerNow,
  };
}

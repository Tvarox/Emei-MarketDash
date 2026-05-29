"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type InvoiceStatus = "Issued" | "Presented" | "Paid";
export type FlowPhase =
  | "idle"
  | "invoice-issuing" // Earner sends invoice to Engine (document packet L→C)
  | "payer-authorizing" // Payer authorizes payment (orange coin R→C)
  | "engine-processing" // Engine validates mandate + reputation
  | "earner-receiving"; // Engine disburses to Earner (green coin C→L)

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
  agentA: { name: string; role: string; address: string; balance: number; reputation: number };
  agentB: { name: string; role: string; address: string; balance: number; reputation: number };
  flowPhase: FlowPhase;
  pendingFlowAmount: number;
  pendingInvoiceId: number | null;
  blockProgress: number;
}

const CATEGORIES = ["data-signal", "data-signal", "data-signal", "alpha-feed", "risk-score"];

function generateTxHash(): string {
  const chars = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 40; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function randomAmount(): number {
  const r = Math.random();
  if (r < 0.6) return 1.0;
  if (r < 0.85) return Math.round((Math.random() * 4 + 2) * 100) / 100;
  return Math.round((Math.random() * 15 + 5) * 100) / 100;
}

const INITIAL_INVOICES: Invoice[] = [
  { id: 42, status: "Issued", amount: 1.0, category: "data-signal", txHash: generateTxHash(), issuedTick: 0 },
  { id: 41, status: "Issued", amount: 1.0, category: "data-signal", txHash: generateTxHash(), issuedTick: -1 },
  { id: 40, status: "Presented", amount: 1.0, category: "data-signal", txHash: generateTxHash(), issuedTick: -2, presentedTick: 0 },
  { id: 39, status: "Presented", amount: 1.0, category: "data-signal", txHash: generateTxHash(), issuedTick: -3, presentedTick: -1 },
  { id: 38, status: "Paid", amount: 1.0, category: "data-signal", txHash: generateTxHash(), issuedTick: -4, presentedTick: -3, paidTick: -1 },
  { id: 37, status: "Paid", amount: 1.0, category: "alpha-feed", txHash: generateTxHash(), issuedTick: -5, presentedTick: -4, paidTick: -2 },
  { id: 36, status: "Paid", amount: 1.0, category: "data-signal", txHash: generateTxHash(), issuedTick: -6, presentedTick: -5, paidTick: -3 },
  { id: 35, status: "Paid", amount: 1.0, category: "data-signal", txHash: generateTxHash(), issuedTick: -7, presentedTick: -6, paidTick: -4 },
];

const PAYER_TOPUP_THRESHOLD = 50;
const PAYER_TOPUP_AMOUNT = 1000;
const PAYER_INITIAL_BALANCE = 1000;

export function useProtocolSimulation(): ProtocolState & {
  triggerNow: () => void;
} {
  const [state, setState] = useState<Omit<ProtocolState, "blockProgress">>(() => ({
    block: 42,
    invoices: INITIAL_INVOICES,
    tvl: 28.0,
    gmvSettled: 23.0,
    agentA: {
      name: "Signal Agent",
      role: "Earner",
      address: "0x277D...d735",
      balance: 29.0,
      reputation: 10000,
    },
    agentB: {
      name: "Trader Agent",
      role: "Payer",
      address: "0xf980...591B",
      balance: PAYER_INITIAL_BALANCE,
      reputation: 10000,
    },
    flowPhase: "idle",
    pendingFlowAmount: 0,
    pendingInvoiceId: null,
  }));

  const [blockProgress, setBlockProgress] = useState(0);
  const tickRef = useRef(0);
  const nextInvoiceId = useRef(43);
  const flowTimers = useRef<NodeJS.Timeout[]>([]);
  const flowPhaseRef = useRef<FlowPhase>("idle");

  const clearFlowTimers = () => {
    flowTimers.current.forEach((t) => clearTimeout(t));
    flowTimers.current = [];
  };

  // Animated settlement: Earner issues invoice -> Payer authorizes -> Engine validates -> Earner receives
  const runPaymentFlow = useCallback((amount: number, invoiceId: number) => {
    if (flowPhaseRef.current !== "idle") return;
    clearFlowTimers();

    // Phase 1: Earner is presenting the invoice to the Engine
    flowPhaseRef.current = "invoice-issuing";
    setState((prev) => ({
      ...prev,
      flowPhase: "invoice-issuing",
      pendingFlowAmount: amount,
      pendingInvoiceId: invoiceId,
    }));

    // Phase 2: Payer authorizes
    flowTimers.current.push(
      setTimeout(() => {
        flowPhaseRef.current = "payer-authorizing";
        setState((prev) => ({ ...prev, flowPhase: "payer-authorizing" }));
      }, 1600)
    );

    // Phase 3: engine processing
    flowTimers.current.push(
      setTimeout(() => {
        flowPhaseRef.current = "engine-processing";
        setState((prev) => ({ ...prev, flowPhase: "engine-processing" }));
      }, 3200)
    );

    // Phase 4: earner receiving
    flowTimers.current.push(
      setTimeout(() => {
        flowPhaseRef.current = "earner-receiving";
        setState((prev) => ({ ...prev, flowPhase: "earner-receiving" }));
      }, 4300)
    );

    // Phase 5: complete - apply state changes
    flowTimers.current.push(
      setTimeout(() => {
        flowPhaseRef.current = "idle";
        setState((prev) => {
          const updatedInvoices = prev.invoices.map((inv) =>
            inv.id === invoiceId
              ? { ...inv, status: "Paid" as InvoiceStatus, paidTick: tickRef.current }
              : inv
          );
          let payerBalance = +(prev.agentB.balance - amount).toFixed(2);
          if (payerBalance < PAYER_TOPUP_THRESHOLD) {
            payerBalance = +(payerBalance + PAYER_TOPUP_AMOUNT).toFixed(2);
          }
          return {
            ...prev,
            invoices: updatedInvoices,
            flowPhase: "idle",
            pendingFlowAmount: 0,
            pendingInvoiceId: null,
            agentA: { ...prev.agentA, balance: +(prev.agentA.balance + amount).toFixed(2) },
            agentB: { ...prev.agentB, balance: payerBalance },
            gmvSettled: +(prev.gmvSettled + amount).toFixed(2),
            tvl: +(prev.tvl + amount * 0.05).toFixed(2),
          };
        });
      }, 5800)
    );
  }, []);

  // Block ticker
  useEffect(() => {
    let raf: number;
    let lastBlockTime = performance.now();
    const BLOCK_INTERVAL = 2000;

    const animate = (now: number) => {
      const elapsed = now - lastBlockTime;
      const progress = Math.min(elapsed / BLOCK_INTERVAL, 1);
      setBlockProgress(progress);

      if (elapsed >= BLOCK_INTERVAL) {
        lastBlockTime = now;
        setState((prev) => ({
          ...prev,
          block: prev.block + 1,
          tvl: +(prev.tvl + (Math.random() - 0.45) * 0.02).toFixed(2),
        }));
      }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Issue new invoices every 4-7s
  useEffect(() => {
    const scheduleNext = () => {
      const delay = 4000 + Math.random() * 3000;
      return setTimeout(() => {
        tickRef.current += 1;
        const newId = nextInvoiceId.current++;
        const amount = randomAmount();
        const newInvoice: Invoice = {
          id: newId,
          status: "Issued",
          amount,
          category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
          txHash: generateTxHash(),
          issuedTick: tickRef.current,
        };
        setState((prev) => ({
          ...prev,
          invoices: [newInvoice, ...prev.invoices].slice(0, 50),
        }));
        timer = scheduleNext();
      }, delay);
    };
    let timer = scheduleNext();
    return () => clearTimeout(timer);
  }, []);

  // Promote Issued -> Presented every 3-5s
  useEffect(() => {
    const scheduleNext = () => {
      const delay = 3000 + Math.random() * 2000;
      return setTimeout(() => {
        setState((prev) => {
          const candidates = prev.invoices.filter((i) => i.status === "Issued");
          if (candidates.length === 0) return prev;
          const target = candidates[candidates.length - 1];
          tickRef.current += 1;
          return {
            ...prev,
            invoices: prev.invoices.map((inv) =>
              inv.id === target.id
                ? { ...inv, status: "Presented" as InvoiceStatus, presentedTick: tickRef.current }
                : inv
            ),
          };
        });
        timer = scheduleNext();
      }, delay);
    };
    let timer = scheduleNext();
    return () => clearTimeout(timer);
  }, []);

  // Auto-settlement loop: every 5-8s pick a Presented invoice and pay it
  useEffect(() => {
    const scheduleNext = () => {
      const delay = 5000 + Math.random() * 3000;
      return setTimeout(() => {
        setState((prev) => {
          if (flowPhaseRef.current !== "idle") return prev;
          const candidates = prev.invoices.filter((i) => i.status === "Presented");
          if (candidates.length === 0) return prev;
          const target = candidates[candidates.length - 1];
          // Schedule the visual flow asynchronously
          queueMicrotask(() => runPaymentFlow(target.amount, target.id));
          return prev;
        });
        timer = scheduleNext();
      }, delay);
    };
    let timer = scheduleNext();
    return () => clearTimeout(timer);
  }, [runPaymentFlow]);

  // Manual trigger: ALWAYS does something visible
  const triggerNow = useCallback(() => {
    if (flowPhaseRef.current !== "idle") return;

    setState((prev) => {
      // 1) Prefer settling a Presented invoice
      const presented = prev.invoices.filter((i) => i.status === "Presented");
      if (presented.length > 0) {
        const target = presented[presented.length - 1];
        queueMicrotask(() => runPaymentFlow(target.amount, target.id));
        return prev;
      }
      // 2) Otherwise, promote an Issued invoice and immediately pay it
      const issued = prev.invoices.filter((i) => i.status === "Issued");
      if (issued.length > 0) {
        const target = issued[issued.length - 1];
        tickRef.current += 1;
        const tick = tickRef.current;
        queueMicrotask(() => runPaymentFlow(target.amount, target.id));
        return {
          ...prev,
          invoices: prev.invoices.map((inv) =>
            inv.id === target.id
              ? { ...inv, status: "Presented" as InvoiceStatus, presentedTick: tick }
              : inv
          ),
        };
      }
      // 3) Last resort: mint a fresh invoice on the spot and pay it
      tickRef.current += 1;
      const tick = tickRef.current;
      const newId = nextInvoiceId.current++;
      const amount = randomAmount();
      const newInvoice: Invoice = {
        id: newId,
        status: "Presented",
        amount,
        category: CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)],
        txHash: generateTxHash(),
        issuedTick: tick,
        presentedTick: tick,
      };
      queueMicrotask(() => runPaymentFlow(amount, newId));
      return {
        ...prev,
        invoices: [newInvoice, ...prev.invoices].slice(0, 50),
      };
    });
  }, [runPaymentFlow]);

  useEffect(() => () => clearFlowTimers(), []);

  return { ...state, blockProgress, triggerNow };
}

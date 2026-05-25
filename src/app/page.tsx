"use client";

import Header from "@/components/Header";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import AgentEconomy from "@/components/AgentEconomy";
import SettlementLedger from "@/components/SettlementLedger";
import { useProtocolLive } from "@/hooks/useProtocolLive";

export type { InvoiceStatus, FlowPhase } from "@/hooks/useProtocolLive";

export default function Home() {
  const sim = useProtocolLive();

  const issued = sim.invoicesIssued;
  const paid = sim.invoicesPaid;
  const presented = sim.invoicesPresented;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Background gradient ambience */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-white via-zinc-50 to-zinc-100/60" />
      <div className="fixed inset-0 -z-10 opacity-[0.015] bg-[radial-gradient(circle_at_50%_-20%,rgba(249,115,22,0.4),transparent_50%)]" />

      <Header block={sim.block} blockProgress={sim.blockProgress} />

      <main className="flex-1 max-w-[1280px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-8">
        {/* Hero Headline */}
        <section className="space-y-2">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-[0.18em]">
            EMEI Protocol · Live Monitor
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-zinc-900">
            The Financial OS for AI Agents
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 max-w-2xl">
            Autonomous invoicing, reputation-gated underwriting, and instant
            settlement between machine-to-machine agents.
          </p>
        </section>

        <ExecutiveSummary
          tvl={sim.tvl}
          volumeSettled={sim.gmvSettled}
          paid={paid}
          issued={issued}
          presented={presented}
          receiptsAnchored={sim.receiptsAnchored}
          latestReceiptRoot={sim.latestReceiptRoot}
          latestReceiptAt={sim.latestReceiptAt}
          network={sim.network}
          chainId={sim.chainId}
          invoices={sim.invoices}
          agents={sim.agents}
          mandates={sim.mandates}
          activeMandates={sim.activeMandates}
          statsTotals={{
            invoices_issued: sim.invoicesIssued,
            invoices_presented: sim.invoicesPresented,
            invoices_paid: sim.invoicesPaid,
            invoices_overdue: sim.invoicesOverdue,
            mandates_created: sim.mandatesCreated,
            mandates_revoked: sim.mandatesRevoked,
            receipts_anchored: sim.receiptsAnchored,
            settlements: sim.settlements,
          }}
        />

        <AgentEconomy
          agentA={sim.agentA}
          agentB={sim.agentB}
          flowPhase={sim.flowPhase}
          pendingFlowAmount={sim.pendingFlowAmount}
          pendingInvoiceId={sim.pendingInvoiceId}
          presented={presented}
          onTrigger={sim.triggerNow}
        />

        <SettlementLedger
          events={sim.invoices}
          totals={{
            issued: sim.invoicesIssued,
            presented: sim.invoicesPresented,
            paid: sim.invoicesPaid,
          }}
        />

        {/* Footer */}
        <footer className="pt-6 pb-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-200/60 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                sim.online ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            <span>
              {sim.online ? "All systems operational" : "Reconnecting…"} ·{" "}
              {sim.invoices.length} invoices tracked · {sim.receiptsAnchored} receipts
              anchored
            </span>
          </div>
          <div className="font-[family-name:var(--font-jetbrains)]">
            EMEI v0.1.0 · Mantle Sepolia · Chain 5003
          </div>
        </footer>
      </main>
    </div>
  );
}

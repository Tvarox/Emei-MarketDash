"use client";

import Header from "@/components/Header";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import AgentEconomy from "@/components/AgentEconomy";
import SettlementLedger from "@/components/SettlementLedger";
import VaultVolumeChart from "@/components/VaultVolumeChart";
import { useProtocolLive } from "@/hooks/useProtocolLive";

export type { InvoiceStatus, FlowPhase } from "@/hooks/useProtocolLive";

export default function Home() {
  const sim = useProtocolLive();

  const issued = sim.invoicesIssued;
  const paid = sim.invoicesPaid;
  const presented = sim.invoicesPresented;

  return (
    <div className="min-h-screen flex flex-col">
      <div className="fixed inset-0 -z-10 bg-white" />
      <div className="fixed inset-x-0 top-0 -z-10 h-[40vh] bg-zinc-950" />

      <Header />

      <main className="flex-1 max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-8">
        <section className="space-y-3">
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-[0.18em]">
            EMEI Protocol · Live Monitor
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white sm:shrink-0 sm:whitespace-nowrap">
              The Financial OS for AI Agents
            </h1>
            <div className="hidden sm:block w-px self-stretch bg-zinc-600" />
            <p className="text-sm sm:text-base text-zinc-400 max-w-md">
              Autonomous invoicing, reputation-gated underwriting, and instant
              settlement between machine-to-machine agents.
            </p>
          </div>
        </section>

        <div className="flex flex-col lg:flex-row lg:items-start gap-6">
          <div className="w-full lg:w-[280px] xl:w-[300px] shrink-0 lg:order-last lg:sticky lg:top-[5rem] lg:h-[calc(100vh-6rem)] overflow-hidden">
            <ExecutiveSummary
              tvl={sim.tvl}
              volumeSettled={sim.gmvSettled}
              paid={paid}
              issued={issued}
              presented={presented}
              overdue={sim.invoicesOverdue}
              receiptsAnchored={sim.receiptsAnchored}
              latestReceiptRoot={sim.latestReceiptRoot}
            />
          </div>

          <div className="flex-1 min-w-0 space-y-8">
            <VaultVolumeChart agents={sim.agents} />

            <SettlementLedger
              events={sim.invoices}
              totals={{
                issued: sim.invoicesIssued,
                presented: sim.invoicesPresented,
                paid: sim.invoicesPaid,
                overdue: sim.invoicesOverdue,
              }}
            />

            <div className="desktop-only">
              <AgentEconomy />
            </div>

            <footer className="pt-6 pb-2 flex items-center justify-between text-xs text-zinc-400 border-t border-zinc-200/60 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full ${sim.online ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
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
          </div>
        </div>
      </main>
    </div>
  );
}

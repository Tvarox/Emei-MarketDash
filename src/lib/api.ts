/**
 * EMEI Facilitator API client.
 *
 * All endpoints are public, read-only, CORS-permissive.
 * Configure via NEXT_PUBLIC_FACILITATOR_URL; defaults to the public Render deploy.
 */

export const API_BASE =
  process.env.NEXT_PUBLIC_FACILITATOR_URL?.replace(/\/$/, "") ??
  "https://emei-facilitator.onrender.com";

// ---------- Response shapes (mirrors live API) ----------

export interface StatsResponse {
  totals: {
    invoices_issued: number;
    invoices_presented: number;
    invoices_paid: number;
    invoices_overdue: number;
    mandates_created: number;
    mandates_revoked: number;
    receipts_anchored: number;
    settlements: number;
  };
  gmv_settled_musd: string;
  active_mandates: number;
  vault_tvl_musd: string;
  latest_block: number;
  latest_receipt_root: string | null;
  latest_receipt_at: number | null;
  chain_id: number;
  network: string;
}

export interface AgentResponse {
  address: string;
  label: string;
  vault_balance_musd: string;
  reputation_score: number;
  invoices_issued: number;
  invoices_paid_to_them: number;
  invoices_paid_by_them: number;
  active_mandates: number;
}

export interface AgentsResponse {
  agents: AgentResponse[];
}

export type EventType =
  | "InvoiceCreated"
  | "InvoicePresented"
  | "InvoicePaid"
  | "InvoiceOverdue"
  | "InvoiceRejected"
  | "MandateCreated"
  | "MandateRevoked"
  | "MerkleRootPosted"
  | "SettlementExecuted";

export interface EventResponse {
  type: EventType;
  block: number;
  tx_hash: string;
  log_index: number;
  timestamp: number;
  invoice_id: number | null;
  issuer: string | null;
  payer: string | null;
  amount_musd: string | null;
  category: string | null;
}

export interface EventsResponse {
  events: EventResponse[];
  next_before: number | null;
}

export interface MandateInfo {
  id: string;
  owner_label?: string;
  owner: string;
  counterparties?: string[];
  counterparty_labels?: string[];
  categories?: string[];
  spend_cap_musd?: string;
  spent_musd?: string;
  remaining_musd?: string;
  utilization_pct?: number;
  expires_at?: number;
  created_at?: number;
  last_collect_at_sec_ago?: number | null;
  revoked?: boolean;
}

export interface MandatesResponse {
  mandates: MandateInfo[];
}

// ---------- Fetcher ----------

async function fetchJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    signal,
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`EMEI API ${res.status}: ${res.statusText} (${path})`);
  }
  return (await res.json()) as T;
}

export const fetchStats = (signal?: AbortSignal) =>
  fetchJSON<StatsResponse>("/emei/public/stats", signal);

export const fetchEvents = (limit = 50, signal?: AbortSignal) =>
  fetchJSON<EventsResponse>(`/emei/public/events?limit=${limit}`, signal);

export const fetchAgents = (signal?: AbortSignal) =>
  fetchJSON<AgentsResponse>("/emei/public/agents", signal);

export const fetchMandates = (signal?: AbortSignal) =>
  fetchJSON<MandatesResponse>("/emei/public/mandates", signal);

// ---------- Helpers ----------

export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "0x????…????";
  const a = addr.startsWith("0x") ? addr : `0x${addr}`;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function shortHash(hash: string | null | undefined, lead = 8, tail = 4): string {
  if (!hash) return "—";
  const h = hash.startsWith("0x") ? hash : `0x${hash}`;
  if (h.length <= lead + tail + 1) return h;
  return `${h.slice(0, lead)}…${h.slice(-tail)}`;
}

export function parseAmount(amount: string | null | undefined, fallback = 0): number {
  if (amount == null) return fallback;
  const n = parseFloat(amount);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Bay8004 stores reputation as 10000 = 100.00. Display in 0–100 range.
 * Falls back gracefully for already-scaled values < 100.
 */
export function scaleReputation(raw: number | undefined | null): number {
  if (raw == null || !Number.isFinite(raw)) return 0;
  if (raw <= 100) return Math.round(raw);
  return Math.min(100, Math.round(raw / 100));
}

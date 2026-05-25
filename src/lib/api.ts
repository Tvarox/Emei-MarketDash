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
  // The "id" pair: live API returns `mandate_id`; some older shapes used `id`.
  mandate_id?: number;
  id?: string;
  owner_label?: string;
  owner?: string;
  payer?: string;
  payer_label?: string;
  counterparties?: string[];
  counterparty_labels?: string[];
  approved_counterparties?: string[];
  approved_categories?: string[];
  categories?: string[];
  spend_cap_musd?: string;
  spent_musd?: string;
  // Live API field names. Older `remaining_musd` kept for backward compat.
  remaining_cap_musd?: string;
  remaining_musd?: string;
  utilization_pct?: number;
  valid_from?: number;
  valid_until?: number;
  expires_at?: number;
  created_at?: number;
  last_collect_at_sec_ago?: number | null;
  /** "active" | "revoked" | etc. — present on the live API. */
  status?: string;
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

/**
 * Walk the events cursor (`next_before`) up to `maxPages` times, accumulating
 * events newest-first. The API caps each response at 100 events regardless of
 * the requested limit.
 *
 *   - `pageSize` is the per-request limit (capped at 100 server-side).
 *   - `maxPages` bounds the total work; stops early if the server returns a
 *     null cursor or fewer events than requested.
 */
export async function fetchEventsPaginated(
  pageSize = 100,
  maxPages = 5,
  signal?: AbortSignal
): Promise<EventResponse[]> {
  const all: EventResponse[] = [];
  let before: number | null = null;
  for (let page = 0; page < maxPages; page++) {
    const path: string =
      `/emei/public/events?limit=${pageSize}` +
      (before != null ? `&before=${before}` : "");
    const resp = await fetchJSON<EventsResponse>(path, signal);
    all.push(...resp.events);
    if (resp.next_before == null || resp.events.length < pageSize) break;
    before = resp.next_before;
  }
  return all;
}

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

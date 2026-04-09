import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyTable } from "@/lib/db/verifyTable";

const ROUTE = "strategy_collect";
const MAX_ORDERS = 50_000;
const MAX_LEADS = 20_000;
const MAX_LOGS = 8_000;

export type OrderRow = {
  id: string;
  line_total: number;
  created_at: string | null;
};

export type LeadRow = {
  id: string;
  created_at: string | null;
};

export type LogRow = {
  action: string;
  metadata: unknown;
  created_at: string | null;
};

export type SystemDataBundle = {
  windowDays: number;
  sinceIso: string;
  orders: OrderRow[];
  leads: LeadRow[];
  logs: LogRow[];
  counts: {
    orders: number;
    leads: number;
    socialClicks: number;
    errorLikeLogs: number;
  };
  totalRevenue: number;
  explain: string;
};

function numLineTotal(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function rowLooksError(action: string, m: unknown): boolean {
  const a = String(action ?? "").toLowerCase();
  if (a.includes("error") || a.includes("fail")) return true;
  if (m && typeof m === "object") {
    const o = m as Record<string, unknown>;
    if (o.error != null) return true;
    if (o.status === "error") return true;
    if (typeof o.ok === "boolean" && o.ok === false) return true;
  }
  return false;
}

/**
 * Windowed, bounded reads — real counts + revenue sum; logs sampled for error heuristics.
 */
export async function collectSystemData(
  supabase: SupabaseClient,
  opts: { windowDays: number }
): Promise<SystemDataBundle> {
  const windowDays = Math.min(90, Math.max(7, Math.floor(opts.windowDays)));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const sinceIso = since;

  const empty: SystemDataBundle = {
    windowDays,
    sinceIso,
    orders: [],
    leads: [],
    logs: [],
    counts: { orders: 0, leads: 0, socialClicks: 0, errorLikeLogs: 0 },
    totalRevenue: 0,
    explain: "Ingen data (tabell utilgjengelig eller tomt vindu).",
  };

  const ordersOk = await verifyTable(supabase, "orders", ROUTE);
  const leadsOk = await verifyTable(supabase, "lead_pipeline", ROUTE);
  const logsOk = await verifyTable(supabase, "ai_activity_log", ROUTE);

  let orderCount = 0;
  let leadCount = 0;
  let socialClicks = 0;

  if (ordersOk) {
    const c = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (!c.error && typeof c.count === "number") orderCount = c.count;
  }

  if (leadsOk) {
    const c = await supabase
      .from("lead_pipeline")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since);
    if (!c.error && typeof c.count === "number") leadCount = c.count;
  }

  if (logsOk) {
    const c = await supabase
      .from("ai_activity_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "social_click")
      .gte("created_at", since);
    if (!c.error && typeof c.count === "number") socialClicks = c.count;
  }

  const orders: OrderRow[] = [];
  if (ordersOk) {
    const { data, error } = await supabase
      .from("orders")
      .select("id,line_total,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_ORDERS);
    if (!error && Array.isArray(data)) {
      for (const raw of data) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        const id = typeof r.id === "string" ? r.id : "";
        if (!id) continue;
        orders.push({
          id,
          line_total: numLineTotal(r.line_total),
          created_at: typeof r.created_at === "string" ? r.created_at : null,
        });
      }
    }
  }

  const leads: LeadRow[] = [];
  if (leadsOk) {
    const { data, error } = await supabase
      .from("lead_pipeline")
      .select("id,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_LEADS);
    if (!error && Array.isArray(data)) {
      for (const raw of data) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        const id = typeof r.id === "string" ? r.id : "";
        if (!id) continue;
        leads.push({
          id,
          created_at: typeof r.created_at === "string" ? r.created_at : null,
        });
      }
    }
  }

  const logs: LogRow[] = [];
  let errorLikeLogs = 0;
  if (logsOk) {
    const { data, error } = await supabase
      .from("ai_activity_log")
      .select("action,metadata,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_LOGS);
    if (!error && Array.isArray(data)) {
      for (const raw of data) {
        if (!raw || typeof raw !== "object") continue;
        const r = raw as Record<string, unknown>;
        const action = typeof r.action === "string" ? r.action : "";
        const meta = r.metadata;
        const created_at = typeof r.created_at === "string" ? r.created_at : null;
        logs.push({ action, metadata: meta, created_at });
        if (rowLooksError(action, meta)) errorLikeLogs += 1;
      }
    }
  }

  const totalRevenue = orders.reduce((s, o) => s + o.line_total, 0);

  const explain =
    `Vindu ${windowDays} d fra ${sinceIso.slice(0, 10)}. Ordre radlast ${orders.length}/${orderCount} (cap ${MAX_ORDERS}), ` +
    `leads ${leads.length}/${leadCount}, logger ${logs.length} (cap ${MAX_LOGS}). ` +
    `Feillignende rader i logg-sample: ${errorLikeLogs}. Omsetning summert fra innlastede ordre: ${totalRevenue.toFixed(2)}.`;

  return {
    windowDays,
    sinceIso,
    orders,
    leads,
    logs,
    counts: {
      orders: orderCount,
      leads: leadCount,
      socialClicks,
      errorLikeLogs,
    },
    totalRevenue,
    explain,
  };
}

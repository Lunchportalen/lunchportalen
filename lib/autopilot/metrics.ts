import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "autopilot_unified_metrics";
const DEFAULT_WINDOW_DAYS = 7;
/** Hard cap — if the window has more rows, aggregates are not trustworthy (fail-closed). */
const MAX_ORDER_ROWS = 100_000;

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function revenueFromOrderRow(o: Record<string, unknown>): number {
  return num(o.line_total ?? o.total_amount);
}

/**
 * Unified, time-windowed autopilot metrics — all values come from live DB reads (no synthetic series).
 *
 * - **Orders / revenue**: `public.orders` in `[window.startIso, window.endIso]` on `created_at`.
 * - **Sessions**: `public.content_analytics_events` — `event_type = page_view`, `environment = prod`, same window.
 * - **AI logs**: `public.ai_activity_log` — row count in the same window (`created_at`).
 *
 * Comparable normalization: fixed calendar window (`windowDays`), rates derived from the same bounds.
 */
export type AutopilotUnifiedMetrics = {
  schemaVersion: 1;
  window: { startIso: string; endIso: string; windowDays: number };
  revenue: number;
  orders: number;
  sessions: number;
  aiLogEvents: number;
  /** `orders / max(sessions, 1)` — same window. */
  conversionRate: number;
  /** AI activity per session: `aiLogEvents / max(sessions, 1)` (0 when `sessions === 0`). */
  engagement: number;
};

export type GetMetricsResult = { ok: true; metrics: AutopilotUnifiedMetrics } | { ok: false; error: string };

/**
 * Loads unified metrics for the autopilot from real system data (Supabase service role).
 * Fail-closed when admin is not configured, required tables are missing, or queries fail.
 */
export async function getMetrics(opts?: { windowDays?: number }): Promise<GetMetricsResult> {
  const windowDays = Math.max(1, Math.min(90, Math.floor(opts?.windowDays ?? DEFAULT_WINDOW_DAYS)));

  if (!hasSupabaseAdminConfig()) {
    return { ok: false, error: "supabase_admin_unconfigured" };
  }

  const admin = supabaseAdmin();
  const endAt = Date.now();
  const startAt = endAt - windowDays * 24 * 60 * 60 * 1000;
  const startIso = new Date(startAt).toISOString();
  const endIso = new Date(endAt).toISOString();

  const [ordersOk, analyticsOk, logsOk] = await Promise.all([
    verifyTable(admin, "orders", ROUTE),
    verifyTable(admin, "content_analytics_events", ROUTE),
    verifyTable(admin, "ai_activity_log", ROUTE),
  ]);

  if (!ordersOk) return { ok: false, error: "orders_table_unavailable" };
  if (!analyticsOk) return { ok: false, error: "content_analytics_events_unavailable" };
  if (!logsOk) return { ok: false, error: "ai_activity_log_unavailable" };

  const [ordersRes, sessionsRes, aiRes] = await Promise.all([
    admin
      .from("orders")
      .select("line_total, total_amount")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .limit(MAX_ORDER_ROWS),
    admin
      .from("content_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "page_view")
      .eq("environment", "prod")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    admin
      .from("ai_activity_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startIso)
      .lte("created_at", endIso),
  ]);

  if (ordersRes.error) {
    return { ok: false, error: `orders_query_failed:${ordersRes.error.message}` };
  }
  if (sessionsRes.error) {
    return { ok: false, error: `sessions_query_failed:${sessionsRes.error.message}` };
  }
  if (aiRes.error) {
    return { ok: false, error: `ai_logs_query_failed:${aiRes.error.message}` };
  }

  const orderRows = Array.isArray(ordersRes.data) ? ordersRes.data : [];
  if (orderRows.length >= MAX_ORDER_ROWS) {
    return { ok: false, error: "orders_window_truncated_increase_cap_or_narrow_window" };
  }

  let revenue = 0;
  for (const o of orderRows) {
    if (o && typeof o === "object") revenue += revenueFromOrderRow(o as Record<string, unknown>);
  }
  const orders = orderRows.length;

  const sessions = typeof sessionsRes.count === "number" ? sessionsRes.count : 0;
  const aiLogEvents = typeof aiRes.count === "number" ? aiRes.count : 0;

  const conversionRate = orders / Math.max(sessions, 1);
  const engagement = sessions > 0 ? aiLogEvents / sessions : 0;

  return {
    ok: true,
    metrics: {
      schemaVersion: 1,
      window: { startIso, endIso, windowDays },
      revenue,
      orders,
      sessions,
      aiLogEvents,
      conversionRate,
      engagement,
    },
  };
}

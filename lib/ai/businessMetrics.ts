import "server-only";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

type EventRow = { event_type?: string | null };

function countImpression(t: string): boolean {
  const u = t.trim().toLowerCase();
  return u === "view" || u === "impression";
}

/**
 * Deterministic: conversions / (views + impressions) over loaded rows.
 */
export function calculateConversion(events: EventRow[] | null | undefined): number {
  const list = Array.isArray(events) ? events : [];
  let imp = 0;
  let conv = 0;
  for (const e of list) {
    const et = String(e?.event_type ?? "");
    if (countImpression(et)) imp += 1;
    if (et.trim().toLowerCase() === "conversion") conv += 1;
  }
  if (imp <= 0) return 0;
  return conv / imp;
}

type RevRow = { revenue?: unknown; created_at?: string | null };

/**
 * Deterministic: (sum revenue last 7d − sum 7d prior) / max(prior sum, ε).
 */
export function calculateGrowth(revenue: RevRow[] | null | undefined): number {
  const list = Array.isArray(revenue) ? revenue : [];
  const now = Date.now();
  const dayMs = 86_400_000;
  const recentStart = now - 7 * dayMs;
  const prevStart = now - 14 * dayMs;
  let recent = 0;
  let prev = 0;
  for (const r of list) {
    const t = r?.created_at ? Date.parse(String(r.created_at)) : NaN;
    if (!Number.isFinite(t)) continue;
    const amt = Number(r?.revenue ?? 0);
    if (!Number.isFinite(amt) || amt < 0) continue;
    if (t >= recentStart) recent += amt;
    else if (t >= prevStart && t < recentStart) prev += amt;
  }
  const eps = 1e-9;
  return (recent - prev) / Math.max(prev, eps);
}

export type BusinessMetricsSnapshot = {
  conversionRate: number;
  revenueGrowth: number;
  churnRate: number;
  eventRowsSampled: number;
  revenueRowsSampled: number;
  /** Count of experiments with status = running (for blackbox NO_EXPERIMENTS signal). */
  runningExperimentsCount: number;
};

export async function getBusinessMetrics(): Promise<BusinessMetricsSnapshot> {
  const supabase = supabaseAdmin();
  const [evRes, revRes, expCountRes] = await Promise.all([
    supabase.from("experiment_events").select("event_type").limit(50_000),
    supabase.from("experiment_revenue").select("revenue,created_at").limit(50_000),
    supabase.from("experiments").select("id", { count: "exact", head: true }).eq("status", "running"),
  ]);
  if (evRes.error) {
    opsLog("business_metrics.events_error", { message: evRes.error.message });
    throw new Error(evRes.error.message);
  }
  if (revRes.error) {
    opsLog("business_metrics.revenue_error", { message: revRes.error.message });
    throw new Error(revRes.error.message);
  }
  if (expCountRes.error) {
    opsLog("business_metrics.experiments_count_error", { message: expCountRes.error.message });
  }

  const evList = evRes.data ?? [];
  const revList = revRes.data ?? [];
  const runningExperimentsCount =
    !expCountRes.error && typeof expCountRes.count === "number" ? expCountRes.count : 0;

  return {
    conversionRate: calculateConversion(evList),
    revenueGrowth: calculateGrowth(revList),
    churnRate: 0,
    eventRowsSampled: evList.length,
    revenueRowsSampled: revList.length,
    runningExperimentsCount,
  };
}

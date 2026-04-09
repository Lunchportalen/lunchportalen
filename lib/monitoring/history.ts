import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { MetricsHistoryInput } from "./baseline";

const SNAPSHOT_KIND = "monitoring_snapshot";

export async function loadMetricsHistoryForBaseline(
  admin: SupabaseClient,
  limit: number
): Promise<{ history: MetricsHistoryInput; snapshotRows: number }> {
  const { data, error } = await admin
    .from("ai_activity_log")
    .select("metadata")
    .eq("action", "audit")
    .order("created_at", { ascending: false })
    .limit(Math.min(200, Math.max(limit * 4, limit)));

  if (error || !Array.isArray(data)) {
    return { history: { errors: [], latency: [], revenue: [] }, snapshotRows: 0 };
  }

  const errors: number[] = [];
  const latency: number[] = [];
  const revenue: number[] = [];

  for (const row of data) {
    const m = row?.metadata as Record<string, unknown> | undefined;
    if (!m || m.kind !== SNAPSHOT_KIND) continue;
    const e = Number(m.errors);
    const lat = Number(m.latency ?? 0);
    const rev = Number(m.revenue);
    if (!Number.isFinite(e) || !Number.isFinite(rev)) continue;
    errors.push(e);
    latency.push(Number.isFinite(lat) ? lat : 0);
    revenue.push(rev);
    if (errors.length >= limit) break;
  }

  errors.reverse();
  latency.reverse();
  revenue.reverse();

  return {
    history: { errors, latency, revenue },
    snapshotRows: errors.length,
  };
}

export { SNAPSHOT_KIND };

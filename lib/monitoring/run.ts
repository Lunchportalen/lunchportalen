import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { makeRid } from "@/lib/http/respond";
import { buildGraphMetricsPayload } from "@/lib/observability/graphMetrics";
import { opsLog } from "@/lib/ops/log";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

import { sendAlert } from "./alerts";
import { buildBaseline } from "./baseline";
import { detectAnomalies } from "./detect";
import { loadMetricsHistoryForBaseline, SNAPSHOT_KIND } from "./history";
import { aggregateCurrentMetrics } from "./metrics";

export type MonitoringRunResult =
  | {
      ok: true;
      rid: string;
      anomalies: ReturnType<typeof detectAnomalies>;
      baseline: ReturnType<typeof buildBaseline>;
      current: ReturnType<typeof aggregateCurrentMetrics>;
      results: { type: string; sent: boolean; rateLimited: boolean }[];
    }
  | { ok: false; rid: string; anomalies: []; reason: string };

/**
 * Single cron tick: load observability snapshot, compare to baseline, notify, persist snapshot for next baseline.
 */
export async function runMonitoring(): Promise<MonitoringRunResult> {
  const rid = makeRid("mon");

  if (!hasSupabaseAdminConfig()) {
    opsLog("monitoring_skipped", { rid, reason: "no_supabase_admin" });
    return { ok: false, rid, anomalies: [], reason: "no_supabase_admin" };
  }

  const admin = supabaseAdmin();
  const payload = await buildGraphMetricsPayload({ windowHours: 6, activityLimit: 3000 });
  const current = aggregateCurrentMetrics(payload);

  const { history, snapshotRows } = await loadMetricsHistoryForBaseline(admin, 30);
  const baseline = buildBaseline(history);

  const anomalies = detectAnomalies(
    { errors: current.errors, latency: current.latency ?? 0, revenue: current.revenue },
    baseline,
    { historyCount: snapshotRows }
  );

  const results: { type: string; sent: boolean; rateLimited: boolean }[] = [];
  for (const a of anomalies) {
    try {
      const r = await sendAlert(admin, a, { rid });
      results.push({ type: a.type, sent: r.sent, rateLimited: r.rateLimited });
    } catch (e) {
      opsLog("monitoring_send_alert_failed", {
        rid,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const snapshotRow = buildAiActivityLogRow({
    action: "audit",
    metadata: {
      kind: SNAPSHOT_KIND,
      rid,
      errors: current.errors,
      latency: current.latency ?? 0,
      revenue: current.revenue,
      leadPipelineRecentWrites: current.leadPipelineRecentWrites,
      windowHours: payload.windowHours,
      generatedAt: payload.generatedAt,
    },
  });

  const { error: snapErr } = await admin.from("ai_activity_log").insert(snapshotRow as Record<string, unknown>);
  if (snapErr) {
    opsLog("monitoring_snapshot_failed", { rid, message: snapErr.message });
  }

  opsLog("monitoring_run_complete", {
    rid,
    anomalyCount: anomalies.length,
    snapshotRows,
    baseline: {
      avgErrors: baseline.avgErrors,
      avgLatency: baseline.avgLatency,
      avgRevenue: baseline.avgRevenue,
    },
  });

  return {
    ok: true,
    rid,
    anomalies,
    baseline,
    current,
    results,
  };
}

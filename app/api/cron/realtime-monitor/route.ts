export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { runAlerting } from "@/lib/observability/alertOrchestrator";
import { buildMetricsSnapshot, businessMetricsToSnapshotInput } from "@/lib/observability/metricsEngine";
import { storeAlert } from "@/lib/observability/storeAlert";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { rid } from "@/lib/http/rid";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = rid("realtime_monitor");

    try {
      requireCronAuth(req, { secretEnvVar: "SYSTEM_MOTOR_SECRET", missingCode: "system_motor_secret_missing" });
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? e);
      const code = String((e as { code?: unknown })?.code ?? "").trim();
      if (msg === "system_motor_secret_missing" || code === "system_motor_secret_missing") {
        return jsonErr(requestId, "SYSTEM_MOTOR_SECRET er ikke satt.", 500, "MISCONFIGURED");
      }
      if (msg === "forbidden" || code === "forbidden") {
        return jsonErr(requestId, "Ugyldig cron-secret.", 403, "FORBIDDEN");
      }
      return jsonErr(requestId, "Cron-gate feilet.", 500, "CRON_AUTH_ERROR");
    }

    if (safeTrim(process.env.MONITORING_ENABLED) !== "true") {
      opsLog("realtime_monitor_skipped", { rid: requestId, reason: "MONITORING_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, anomalies: [] as string[], findings: [] }, 200);
    }

    try {
      const raw = await getBusinessMetrics();
      const snapshot = buildMetricsSnapshot(businessMetricsToSnapshotInput(raw));

      const findings = await runAlerting(snapshot);

      for (const r of findings) {
        await storeAlert(`PREDICTIVE_${r.level}_${r.metric}`, {
          snapshot,
          rid: requestId,
          metric: r.metric,
          value: r.value,
          score: r.score,
          level: r.level,
          baseline: r.baseline,
        });
      }

      const anomalyCodes = findings.map((f) => `PREDICTIVE_${f.level}_${f.metric}`);
      opsLog("realtime_monitor_run", { rid: requestId, anomalyCount: findings.length });
      return jsonOk(requestId, { anomalies: anomalyCodes, findings }, 200);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("realtime_monitor_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "MONITOR_FAILED");
    }
  });
}

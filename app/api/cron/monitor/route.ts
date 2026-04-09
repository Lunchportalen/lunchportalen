export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { checkAlerts } from "@/lib/observability/alertEngine";
import { buildMetricsSnapshot, businessMetricsToSnapshotInput } from "@/lib/observability/metricsEngine";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { rid } from "@/lib/http/rid";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = rid("monitor");

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

    try {
      const metrics = await getBusinessMetrics();
      const snapshot = buildMetricsSnapshot(businessMetricsToSnapshotInput(metrics));
      checkAlerts(snapshot);
      opsLog("cron_monitor_run", { rid: requestId, conversion: snapshot.conversion, churn: snapshot.churn });
      return jsonOk(requestId, { ok: true, snapshot }, 200);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("cron_monitor_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "MONITOR_FAILED");
    }
  });
}

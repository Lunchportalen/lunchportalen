/**
 * Capital allocation advisory cron — ROI/risk scoring and % weights only. No payments, no ledger writes.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { allocateCapital } from "@/lib/ai/capital/allocationEngine";
import { buildCapitalReport } from "@/lib/ai/capital/capitalOutput";
import { buildCapitalState } from "@/lib/ai/capital/capitalState";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

function safeTrim(v: unknown) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = makeRid("capital_allocation");

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

    if (!isSystemEnabled()) {
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "capital_allocation" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.CAPITAL_ENGINE_ENABLED) !== "true") {
      opsLog("capital_allocation_skipped", { rid: requestId, reason: "CAPITAL_ENGINE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "CAPITAL_ENGINE_ENABLED is not true" }, 200);
    }

    let metrics;
    try {
      metrics = await getBusinessMetrics();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("capital_allocation_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const state = buildCapitalState(metrics);
      const allocation = allocateCapital(state);
      const report = buildCapitalReport(state, allocation);

      opsLog("capital_allocation_run", {
        rid: requestId,
        state,
        allocation,
        topPriority: report.topPriority,
      });

      return jsonOk(requestId, report, 200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("capital_allocation_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}

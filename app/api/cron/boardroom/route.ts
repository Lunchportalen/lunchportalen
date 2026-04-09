/**
 * Boardroom simulation: CEO / CFO / investor perspectives → merged recommendations + scenarios.
 * Read-only: no automation execution, no DB writes (audit via opsLog + API response only).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { buildBoardReport } from "@/lib/ai/boardroom/boardOutput";
import { mergeBoardDecisions } from "@/lib/ai/boardroom/boardDecisionEngine";
import { buildBoardState } from "@/lib/ai/boardroom/boardState";
import { ceoStrategy } from "@/lib/ai/boardroom/ceoEngine";
import { cfoStrategy } from "@/lib/ai/boardroom/cfoEngine";
import { investorStrategy } from "@/lib/ai/boardroom/investorEngine";
import { simulateScenarios } from "@/lib/ai/boardroom/scenarioEngine";
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
    const requestId = makeRid("boardroom");

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
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "boardroom" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.BOARDROOM_ENABLED) !== "true") {
      opsLog("boardroom_skipped", { rid: requestId, reason: "BOARDROOM_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "BOARDROOM_ENABLED is not true" }, 200);
    }

    let metrics;
    try {
      metrics = await getBusinessMetrics();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("boardroom_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const state = buildBoardState(metrics);
      const ceo = ceoStrategy(state);
      const cfo = cfoStrategy(state);
      const investor = investorStrategy(state);
      const decisions = mergeBoardDecisions(ceo, cfo, investor);
      const scenarios = simulateScenarios(state);
      const report = buildBoardReport(state, decisions, scenarios);

      opsLog("boardroom_run", {
        rid: requestId,
        state,
        ceo,
        cfo,
        investor,
        decisions,
        scenarios,
      });

      return jsonOk(requestId, report, 200);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("boardroom_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}

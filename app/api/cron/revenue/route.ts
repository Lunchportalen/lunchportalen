export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runRevenueAutopilotLoop } from "@/lib/autonomy/runRevenue";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Scheduled: samme lukkede løyfe som POST /api/autonomy/revenue (cron-secret + env).
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const rid = makeRid("cron_revenue");

    try {
      requireCronAuth(req, { secretEnvVar: "SYSTEM_MOTOR_SECRET", missingCode: "system_motor_secret_missing" });
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? e);
      const code = String((e as { code?: unknown })?.code ?? "").trim();
      if (msg === "system_motor_secret_missing" || code === "system_motor_secret_missing") {
        return jsonErr(rid, "SYSTEM_MOTOR_SECRET er ikke satt.", 500, "MISCONFIGURED");
      }
      if (msg === "forbidden" || code === "forbidden") {
        return jsonErr(rid, "Ugyldig cron-secret.", 403, "FORBIDDEN");
      }
      return jsonErr(rid, "Cron-gate feilet.", 500, "CRON_AUTH_ERROR");
    }

    if (safeStr(process.env.REVENUE_AUTOPILOT_ENABLED) !== "true") {
      opsLog("cron_revenue_skipped", { rid, reason: "REVENUE_AUTOPILOT_ENABLED not true" });
      return jsonOk(rid, { skipped: true, reason: "kill_switch" }, 200);
    }

    const companyId = safeStr(process.env.REVENUE_AUTOPILOT_COMPANY_ID);
    const userId = safeStr(process.env.REVENUE_AUTOPILOT_USER_ID);
    if (!companyId || !userId) {
      return jsonErr(
        rid,
        "REVENUE_AUTOPILOT_COMPANY_ID og REVENUE_AUTOPILOT_USER_ID må settes for cron.",
        503,
        "REVENUE_AI_CONTEXT_MISSING",
      );
    }

    const dryRun = safeStr(process.env.REVENUE_AUTOPILOT_CRON_DRY_RUN) === "true";

    try {
      const out = await runRevenueAutopilotLoop({
        rid,
        aiCtx: { companyId, userId },
        dryRun,
      });
      if (!out.ok) {
        return jsonErr(rid, out.error ?? "Kjøring feilet.", 500, "REVENUE_LOOP_FAILED");
      }
      return jsonOk(rid, { ok: true, rid: out.rid, dryRun: out.dryRun, evaluate: out.evaluate }, 200);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return jsonErr(rid, msg, 500, "REVENUE_LOOP_EXCEPTION");
    }
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  return POST(req);
}

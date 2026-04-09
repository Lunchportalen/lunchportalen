export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runCeoCycle } from "@/lib/ai/ceo/runner";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

function safeTrim(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Controlled AI CEO cycle (deterministic decisions, log-only automation).
 * Separate from legacy POST /api/cron/ai-ceo (business metrics path).
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = makeRid("ceo_controlled");

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

    if (safeTrim(process.env.AI_CEO_CONTROLLED_ENABLED) !== "true") {
      opsLog("ai_ceo_controlled_skipped", { rid: requestId, reason: "AI_CEO_CONTROLLED_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "AI_CEO_CONTROLLED_ENABLED is not true" }, 200);
    }

    let urlForce = false;
    try {
      const u = new URL(req.url);
      urlForce = u.searchParams.get("force") === "1" || u.searchParams.get("force") === "true";
    } catch {
      // ignore
    }

    try {
      const result = await runCeoCycle({
        rid: requestId,
        force: urlForce,
        role: "superadmin",
      });
      opsLog("ai_ceo_controlled_cron_complete", {
        rid: requestId,
        skipped: result.skipped,
        decisionCount: result.decisions.length,
      });
      return jsonOk(requestId, result, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("ai_ceo_controlled_cron_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "CEO_CYCLE_FAILED");
    }
  });
}

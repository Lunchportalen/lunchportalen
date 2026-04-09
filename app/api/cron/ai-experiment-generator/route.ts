export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { createHomeTrafficExperimentCore } from "@/lib/experiments/createHomeTrafficExperimentCore";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { trackUsage } from "@/lib/saas/billingTracker";

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const rid = makeRid("cron_ai_exp");

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

    if (safeTrim(process.env.AI_EXPERIMENTS_ENABLED) !== "true") {
      opsLog("ai_experiment_generator_skipped", { rid, reason: "AI_EXPERIMENTS_ENABLED not true" });
      return jsonOk(rid, { skipped: true, reason: "AI_EXPERIMENTS_ENABLED is not true" }, 200);
    }

    const out = await createHomeTrafficExperimentCore({ rid, source: "cron_ai_experiment_generator" });
    trackUsage({
      kind: "ai_experiment_cron",
      rid,
      ok: out.ok,
      experimentId: out.ok ? out.experimentId : null,
      code: out.ok === false ? out.code : null,
    });

    if (out.ok === false) {
      if (out.code === "EXPERIMENT_RUNNING") {
        opsLog("ai_experiment_generator_noop_running", { rid, code: out.code });
        return jsonOk(rid, { created: false, code: out.code, message: out.message }, 200);
      }
      const status = out.code === "NOT_FOUND" ? 404 : 500;
      return jsonErr(rid, out.message, status, out.code);
    }

    opsLog("ai_experiment_generator_created", { rid, experimentId: out.experimentId, variantIds: out.variantIds });
    return jsonOk(
      rid,
      { created: true, experimentId: out.experimentId, variantIds: out.variantIds },
      200,
    );
  });
}

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

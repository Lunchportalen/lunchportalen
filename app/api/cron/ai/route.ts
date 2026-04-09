export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runAutonomousCycle } from "@/lib/ai/autonomy/runner";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

function safeTrim(v: unknown) {
  return String(v ?? "").trim();
}

/** Multi-agent self-driving cycle (log-only execution). */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = makeRid("cron_ai_autonomy");

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

    if (safeTrim(process.env.AI_AUTONOMY_LAYER_ENABLED) !== "true") {
      opsLog("ai_autonomy_cron_skipped", { rid: requestId, reason: "AI_AUTONOMY_LAYER_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "AI_AUTONOMY_LAYER_ENABLED is not true" }, 200);
    }

    let urlForce = false;
    let eventDriven = false;
    try {
      const u = new URL(req.url);
      urlForce = u.searchParams.get("force") === "1" || u.searchParams.get("force") === "true";
      eventDriven = u.searchParams.get("events") === "1" || u.searchParams.get("events") === "true";
    } catch {
      // ignore
    }

    try {
      const result = await runAutonomousCycle({
        rid: requestId,
        force: urlForce,
        eventDriven,
        role: "superadmin",
      });
      return jsonOk(requestId, result, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("ai_autonomy_cron_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "AUTONOMY_CYCLE_FAILED");
    }
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { isAutopilotEnabled } from "@/lib/autopilot/kill-switch";
import { runAutopilotCycle } from "@/lib/autopilot/engine";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { opsLog } from "@/lib/ops/log";

/**
 * Cron: autonomous growth cycle (proposal + audit log). Never publishes CMS.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("cron_autopilot");

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

  if (!isAutopilotEnabled()) {
    opsLog("cron.autopilot.disabled", { rid });
    return jsonOk(rid, { status: "disabled" }, 200);
  }

  const cycle = await runAutopilotCycle({ rid });
  opsLog("cron.autopilot.done", { rid, cycle });
  return jsonOk(rid, cycle, 200);
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runAutonomyCycle } from "@/lib/ai/autonomyLoop";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

function handleCron(req: NextRequest, method: string) {
  return withApiAiEntrypoint(req, method, async () => {
    const rid = makeRid("cron_autonomy");
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

    try {
      const recommendations = await runAutonomyCycle();
      return jsonOk(rid, { recommendations, count: recommendations.length }, 200);
    } catch (e) {
      return jsonErr(rid, "Autonomi-syklus feilet.", 500, "AUTONOMY_CYCLE_FAILED", e);
    }
  });
}

/** Scheduled runner: audit + recommendations only — no auto-exec. */
export async function POST(req: NextRequest): Promise<Response> {
  return handleCron(req, "POST");
}

export async function GET(req: NextRequest): Promise<Response> {
  return handleCron(req, "GET");
}

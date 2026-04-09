export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runGrowthOptimizationLoop } from "@/lib/growth/runGrowthLoop";
import { runSocialAutonomyCycleFromDb } from "@/lib/social/autonomousRunner";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";

/**
 * Daglig (eller planlagt) trigger — krever gyldig cron-secret.
 * Kjører samme kjerne som POST /api/social/autonomous/run (uten sesjon).
 */
export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const rid = makeRid("cron_social_autonomy");

    try {
      requireCronAuth(req);
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? e);
      const code = String((e as { code?: unknown })?.code ?? "").trim();
      if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
        return jsonErr(rid, "CRON_SECRET er ikke satt.", 500, "MISCONFIGURED");
      }
      if (msg === "forbidden" || code === "forbidden") {
        return jsonErr(rid, "Ugyldig cron-secret.", 403, "FORBIDDEN");
      }
      return jsonErr(rid, "Cron-gate feilet.", 500, "CRON_AUTH_ERROR");
    }

    opsLog("cron.social_autonomy.start", { rid });

    try {
      const result = await runSocialAutonomyCycleFromDb();
      let growth: Awaited<ReturnType<typeof runGrowthOptimizationLoop>> | null = null;
      try {
        growth = await runGrowthOptimizationLoop(rid);
      } catch {
        /* vekstsløyfe skal ikke stoppe cron */
      }
      return jsonOk(rid, { ok: true, result, growth }, 200);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return jsonErr(rid, message, 500, "CRON_SOCIAL_AUTONOMY_FAILED");
    }
  });
}

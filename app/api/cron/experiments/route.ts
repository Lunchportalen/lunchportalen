export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runSocialAbEvaluations } from "@/lib/experiment/runSocialAbEvaluations";
import { runMvoEvaluation } from "@/lib/mvo/runMvoEvaluation";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * SoMe A/B (`ab_experiments` / `ab_variants`) + MVO (ordre-dimensjoner, omsetning per combo, læring).
 * CMS-eksperimenter håndteres av `/api/cron/resolve-experiments`.
 */
export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const rid = makeRid("cron_social_ab");

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

    opsLog("cron.social_ab_experiments.start", { rid });

    const admin = supabaseAdmin();
    const socialAb = await runSocialAbEvaluations(admin, rid);
    const mvo = await runMvoEvaluation(admin, rid);

    opsLog("cron.social_ab_experiments.done", { rid, socialAb, mvo });
    return jsonOk(rid, { socialAb, mvo }, 200);
  });
}

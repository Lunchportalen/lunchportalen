export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runBusinessEngine } from "@/lib/business/runEngine";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const rid = makeRid("cron_business");

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

    const admin = supabaseAdmin();
    const out = await runBusinessEngine(admin, { rid });

    if (!out.ok) {
      if (out.skipped === "missing_ai_context") {
        return jsonErr(
          rid,
          "REVENUE_AUTOPILOT_COMPANY_ID og REVENUE_AUTOPILOT_USER_ID må settes for cron.",
          503,
          "REVENUE_AI_CONTEXT_MISSING",
        );
      }
      return jsonErr(rid, out.error ?? "business_engine_failed", 500, "BUSINESS_ENGINE_FAILED");
    }

    return jsonOk(rid, { skipped: out.skipped, apply: out.apply, socialAb: out.socialAb }, 200);
  });
}

export async function GET(req: NextRequest): Promise<Response> {
  return POST(req);
}

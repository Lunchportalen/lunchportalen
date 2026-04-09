// app/api/cron/ai-governance-auto/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { runAutoRecommendationExecutor, type AiGovernanceAutoDriftMode } from "@/lib/ai/autoExecutor";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
  const rid = makeRid();

  try {
    requireCronAuth(req, { secretEnvVar: "SYSTEM_MOTOR_SECRET", missingCode: "system_motor_secret_missing" });
  } catch (e: unknown) {
    const msg = String((e as { message?: unknown })?.message ?? e);
    const code = String((e as { code?: unknown })?.code ?? "").trim();

    if (msg === "system_motor_secret_missing" || code === "system_motor_secret_missing") {
      return jsonErr(rid, "SYSTEM_MOTOR_SECRET er ikke satt i environment.", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron-secret.", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate.", 500, { code: "server_error", detail: { message: msg } });
  }

  let dryRun = false;
  let month: string | null = null;
  let mode: AiGovernanceAutoDriftMode | null = null;
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      const body = (await req.json()) as { dry_run?: boolean; month?: string; mode?: string };
      dryRun = body?.dry_run === true;
      const m = typeof body?.month === "string" ? body.month.trim() : "";
      month = m || null;
      const mo = typeof body?.mode === "string" ? body.mode.trim().toLowerCase() : "";
      if (mo === "observe" || mo === "assist" || mo === "auto") mode = mo;
    }
  } catch {
    /* optional body */
  }

  try {
    const result = await runAutoRecommendationExecutor({ rid, month, dry_run: dryRun, mode });
    return jsonOk(rid, result, 200);
  } catch (e: unknown) {
    return jsonErr(rid, "Kunne ikke kjøre AI governance auto-executor.", 500, {
      code: "AI_GOVERNANCE_AUTO_FAILED",
      detail: { message: e instanceof Error ? e.message : String(e) },
    });
  }
  });
}

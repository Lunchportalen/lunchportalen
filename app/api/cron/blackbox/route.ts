export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeBlackboxActions } from "@/lib/ai/automationEngine";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { decideBlackboxActions } from "@/lib/ai/decisionEngine";
import { recordLearning } from "@/lib/ai/learningEngine";
import { detectSignals } from "@/lib/ai/signalEngine";
import { buildSystemState } from "@/lib/ai/systemState";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

const RATE_LIMIT_SEC = 300;

function safeTrim(v: unknown) {
  return String(v ?? "").trim();
}

async function secondsSinceLastBlackboxRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_learning")
      .select("created_at")
      .eq("source", "blackbox")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data || data.created_at == null) return null;
    const t = Date.parse(String(data.created_at));
    if (!Number.isFinite(t)) return null;
    return (Date.now() - t) / 1000;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = makeRid("blackbox");

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

    if (!isSystemEnabled()) {
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "blackbox" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.BLACKBOX_ENABLED) !== "true") {
      opsLog("blackbox_skipped", { rid: requestId, reason: "BLACKBOX_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "BLACKBOX_ENABLED is not true" }, 200);
    }

    const elapsed = await secondsSinceLastBlackboxRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("blackbox_rate_limited", {
        rid: requestId,
        elapsedSeconds: elapsed,
        minIntervalSeconds: RATE_LIMIT_SEC,
      });
      return jsonOk(
        requestId,
        {
          skipped: true,
          reason: "rate_limited",
          minIntervalSeconds: RATE_LIMIT_SEC,
          elapsedSeconds: elapsed,
        },
        200,
      );
    }

    let metrics;
    try {
      metrics = await getBusinessMetrics();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("blackbox_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    const state = buildSystemState({ metrics });
    const signals = detectSignals(state);
    const actions = decideBlackboxActions(signals);
    const executed = await executeBlackboxActions(actions, { rid: requestId });

    const learn = await recordLearning("blackbox", {
      kind: "blackbox_cycle",
      rid: requestId,
      state,
      signals,
      actions,
      executed,
    });

    opsLog("blackbox_run", {
      rid: requestId,
      signals,
      actions,
      executed,
      learningOk: learn.ok,
      learningError: learn.ok === false ? learn.message : undefined,
    });

    return jsonOk(
      requestId,
      {
        signals,
        actions,
        executed,
        state,
        learningRecorded: learn.ok,
      },
      200,
    );
  });
}

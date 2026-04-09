/**
 * Perception alignment cron: clarify messaging, consistency, and flow via safe CMS/experiment tooling.
 * Does not fabricate trust content or mislead — see module comments under lib/ai/reality/.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeMarketActions } from "@/lib/ai/automationEngine";
import { recordRealityCycle } from "@/lib/ai/memory/recordRealityCycle";
import { alignPerception } from "@/lib/ai/reality/alignmentEngine";
import { mapRealityActions } from "@/lib/ai/reality/actionMapper";
import { buildNarrative } from "@/lib/ai/reality/narrativeEngine";
import { optimizeCognitiveFlow } from "@/lib/ai/reality/cognitiveFlowEngine";
import { buildPerceptionState } from "@/lib/ai/reality/perceptionEngine";
import { getPerceptionMetrics } from "@/lib/ai/reality/getPerceptionMetrics";
import { reinforceTrust } from "@/lib/ai/reality/trustEngine";
import { buildRealityStrategy } from "@/lib/ai/reality/strategyEngine";
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

async function secondsSinceLastRealityRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("created_at")
      .eq("kind", "reality_cycle")
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
    const requestId = makeRid("reality");

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
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "reality" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.REALITY_MODE_ENABLED) !== "true") {
      opsLog("reality_skipped", { rid: requestId, reason: "REALITY_MODE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "REALITY_MODE_ENABLED is not true" }, 200);
    }

    const elapsed = await secondsSinceLastRealityRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("reality_rate_limited", {
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

    let perceptionMetrics;
    try {
      perceptionMetrics = await getPerceptionMetrics();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("reality_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const state = buildPerceptionState(perceptionMetrics);
      const alignment = alignPerception(state);
      const narrative = buildNarrative(alignment);
      const trust = reinforceTrust(state);
      const flow = optimizeCognitiveFlow(state);
      const strategy = buildRealityStrategy(alignment, narrative, trust, flow);
      const actions = mapRealityActions(strategy);

      opsLog("reality_plan", {
        rid: requestId,
        state,
        alignment,
        narrative,
        trust,
        flow,
        strategy,
        actions,
      });

      const executed = await executeMarketActions(actions, {
        rid: requestId,
        experimentSource: "reality_cron",
      });

      const mem = await recordRealityCycle({
        rid: requestId,
        perceptionState: state,
        strategy,
        actions,
        executed,
      });

      opsLog("reality_engine_run", {
        rid: requestId,
        state,
        strategy,
        executed,
        memoryRecorded: mem.ok,
        memoryError: mem.ok ? undefined : mem.message,
      });

      return jsonOk(
        requestId,
        {
          state,
          alignment,
          narrative,
          trust,
          flow,
          strategy,
          actions,
          executed,
          memoryRecorded: mem.ok,
          ...(mem.ok ? {} : { memoryError: mem.message }),
        },
        200,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("reality_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}

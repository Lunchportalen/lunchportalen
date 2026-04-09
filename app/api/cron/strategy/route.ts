export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeStrategicPlan } from "@/lib/ai/automationEngine";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { recordStrategyCycle } from "@/lib/ai/memory/recordStrategyCycle";
import { buildRoadmap } from "@/lib/ai/roadmapEngine";
import { buildStrategicContext } from "@/lib/ai/strategicContext";
import { prioritizeRoadmap } from "@/lib/ai/strategicPrioritizer";
import { generateStrategicPillars } from "@/lib/ai/strategyEngine";
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

async function secondsSinceLastStrategyRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("created_at")
      .eq("kind", "strategy_cycle")
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
    const requestId = makeRid("strategy");

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
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "strategy" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.STRATEGY_MODE_ENABLED) !== "true") {
      opsLog("strategy_skipped", { rid: requestId, reason: "STRATEGY_MODE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "STRATEGY_MODE_ENABLED is not true" }, 200);
    }

    const elapsed = await secondsSinceLastStrategyRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("strategy_rate_limited", {
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
      opsLog("strategy_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const ctx = buildStrategicContext(metrics);
      const strategy = generateStrategicPillars(ctx);
      const roadmap = buildRoadmap(strategy);
      const prioritized = prioritizeRoadmap(roadmap);

      opsLog("strategy_plan", {
        rid: requestId,
        ctx,
        strategy,
        roadmap: prioritized,
      });

      const executed =
        prioritized.length > 0 ? await executeStrategicPlan(prioritized, { rid: requestId }) : [];

      const mem = await recordStrategyCycle({
        rid: requestId,
        ctx,
        strategy,
        roadmap: prioritized,
        results: executed,
      });

      opsLog("strategy_engine_run", {
        rid: requestId,
        strategy,
        roadmap: prioritized,
        executed,
        memoryRecorded: mem.ok,
        memoryError: mem.ok ? undefined : mem.message,
      });

      return jsonOk(
        requestId,
        {
          ctx,
          strategy,
          roadmap: prioritized,
          executed,
          memoryRecorded: mem.ok,
          ...(mem.ok ? {} : { memoryError: mem.message }),
        },
        200,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("strategy_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}

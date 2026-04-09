export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeSingularityActions, type SingularityExecuteResult } from "@/lib/ai/automationEngine";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { buildGlobalContext } from "@/lib/ai/globalIntelligence";
import { detectOpportunities } from "@/lib/ai/opportunityEngine";
import { generateAction } from "@/lib/ai/generativeEngine";
import type { PredictiveSingularityDecision } from "@/lib/ai/businessDecisionEngine";
import { prioritizeAdaptive } from "@/lib/ai/prioritizationEngine";
import type { SingularityActionWithScore } from "@/lib/ai/prioritizationEngine";
import { explainDecision } from "@/lib/ai/explainEngine";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { recordSingularityOutcome } from "@/lib/ai/memory/recordOutcomeLearning";
import { scoreAction } from "@/lib/ai/valueEngine";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

const RATE_LIMIT_SEC = 300;
const MAX_ACTIONS_PER_RUN = 2;

function safeTrim(v: unknown) {
  return String(v ?? "").trim();
}

async function secondsSinceLastSingularityRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("created_at")
      .eq("kind", "singularity_cycle")
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
    const requestId = makeRid("singularity");

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
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "singularity" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.SINGULARITY_ENABLED) !== "true") {
      opsLog("singularity_skipped", { rid: requestId, reason: "SINGULARITY_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "SINGULARITY_ENABLED is not true" }, 200);
    }

    const elapsed = await secondsSinceLastSingularityRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("singularity_rate_limited", {
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
      opsLog("singularity_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    const ctx = buildGlobalContext({
      revenue: metrics.revenueGrowth,
      conversion: metrics.conversionRate,
      traffic: metrics.eventRowsSampled,
      churn: metrics.churnRate,
      experiments: metrics.runningExperimentsCount,
      topPages: [],
      worstPages: [],
    });

    const opportunities = detectOpportunities(ctx);
    const generated = opportunities.map(generateAction);
    const actions = generated.filter((a): a is NonNullable<typeof a> => a != null);

    opsLog("singularity_plan", {
      rid: requestId,
      ctx,
      opportunities,
      actionTypes: actions.map((a) => a.type),
    });

    const usePredictiveEnv = safeTrim(process.env.PREDICTIVE_MODE) === "true";
    let prioritized: SingularityActionWithScore[] = [];
    let executed: SingularityExecuteResult[] = [];
    let predictiveExtra: Record<string, unknown> | undefined;
    let predictiveDecision: PredictiveSingularityDecision | undefined;
    let usedPredictivePath = false;

    if (usePredictiveEnv) {
      try {
        const { decideWithPrediction } = await import("@/lib/ai/businessDecisionEngine");
        const { explainPrediction } = await import("@/lib/ai/predictiveExplain");
        predictiveDecision = await decideWithPrediction(actions, ctx);
        usedPredictivePath = true;

        opsLog("predictive_decision", {
          rid: requestId,
          ctx,
          simulations: predictiveDecision.simulations,
          chosen: predictiveDecision.best,
          risk: predictiveDecision.risk,
        });
        opsLog("predictive_explain", { rid: requestId, ...explainPrediction(predictiveDecision) });

        if (predictiveDecision.risk !== "SAFE" || !predictiveDecision.best) {
          prioritized = predictiveDecision.best
            ? [{ ...predictiveDecision.best.action, score: 0 }]
            : [];
          executed = [];
          predictiveExtra = {
            skipped: "risk",
            risk: predictiveDecision.risk,
            explain: explainPrediction(predictiveDecision),
            simulations: predictiveDecision.simulations,
          };
        } else {
          prioritized = [{ ...predictiveDecision.best.action, score: 0 }];
          executed = await executeSingularityActions(prioritized, { rid: requestId });
          predictiveExtra = {
            mode: "predictive",
            explain: explainPrediction(predictiveDecision),
            risk: predictiveDecision.risk,
          };
        }

        opsLog("singularity_prioritized_predictive", {
          rid: requestId,
          selected: prioritized.map((a) => ({ type: a.type, score: a.score })),
          maxActions: 1,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        opsLog("predictive_path_failed", { rid: requestId, message });
        usedPredictivePath = false;
      }
    }

    if (!usedPredictivePath) {
      try {
        prioritized = await prioritizeAdaptive(actions, ctx);
      } catch {
        const { prioritize } = await import("@/lib/ai/prioritizationEngine");
        prioritized = await prioritize(actions, ctx);
        opsLog("singularity_prioritize_adaptive_fallback", { rid: requestId, reason: "prioritizeAdaptive_failed" });
      }
      const toRun = prioritized.slice(0, MAX_ACTIONS_PER_RUN);

      opsLog("singularity_prioritized", {
        rid: requestId,
        selected: toRun.map((a) => ({ type: a.type, score: a.score })),
        explained: prioritized.map((p) => {
          const base = scoreAction(p, ctx);
          return explainDecision({ type: p.type }, base, p.score - base);
        }),
        maxActions: MAX_ACTIONS_PER_RUN,
      });

      executed = await executeSingularityActions(toRun, { rid: requestId });
    }

    try {
      const afterMetrics = await getBusinessMetrics();
      await recordSingularityOutcome({
        rid: requestId,
        beforeCtx: ctx,
        beforeMetrics: metrics,
        afterMetrics,
        executed,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("singularity_outcome_learning_failed", { rid: requestId, message });
    }

    let memoryOk = true;
    let memoryError: string | undefined;
    try {
      await insertAiMemory(supabaseAdmin(), {
        kind: "singularity_cycle",
        source_rid: requestId,
        payload: {
          context: ctx,
          opportunities,
          executed,
          prioritized: prioritized.map((p) => ({ type: p.type, score: p.score })),
          predictive: predictiveExtra,
          predictiveSimulations: predictiveDecision?.simulations,
        },
      });
    } catch (err) {
      memoryOk = false;
      memoryError = err instanceof Error ? err.message : String(err);
      opsLog("singularity_memory_failed", { rid: requestId, message: memoryError });
    }

    opsLog("singularity_run", {
      rid: requestId,
      opportunities,
      executed,
      memoryOk,
      memoryError,
      predictiveMode: usedPredictivePath,
    });

    return jsonOk(
      requestId,
      {
        opportunities,
        executed,
        prioritized: prioritized.map((p) => ({ type: p.type, score: p.score })),
        memoryRecorded: memoryOk,
        ...(memoryError ? { memoryError } : {}),
        ...(predictiveExtra ? { predictive: predictiveExtra } : {}),
      },
      200,
    );
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { mapProfitActions } from "@/lib/ai/profit/profitDecisionEngine";
import { detectProfitLeaks } from "@/lib/ai/profit/profitLeakEngine";
import { detectProfitOpportunities } from "@/lib/ai/profit/profitOpportunityEngine";
import { prioritizeProfit, profitActionsToSingularity } from "@/lib/ai/profit/profitPriority";
import { buildProfitStrategy } from "@/lib/ai/profit/profitStrategyEngine";
import { buildProfitState, profitInputsFromBusinessMetrics } from "@/lib/ai/profit/profitState";
import { executeSingularityActions } from "@/lib/ai/automationEngine";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { rid } from "@/lib/http/rid";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "POST", async () => {
    const requestId = rid("profit");

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

    if (safeTrim(process.env.PROFIT_ENGINE_ENABLED) !== "true") {
      opsLog("profit_skipped", { rid: requestId, reason: "PROFIT_ENGINE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "PROFIT_ENGINE_ENABLED is not true" }, 200);
    }

    if (!isSystemEnabled()) {
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "profit" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    let metrics;
    try {
      metrics = await getBusinessMetrics();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("profit_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    const state = buildProfitState(profitInputsFromBusinessMetrics(metrics));
    const leaks = detectProfitLeaks(state);
    const opportunities = detectProfitOpportunities(state);
    const strategy = buildProfitStrategy(leaks, opportunities);
    const mappedActions = mapProfitActions(strategy);
    const prioritized = prioritizeProfit(mappedActions, state);
    const toRun = profitActionsToSingularity(prioritized.slice(0, 2));

    opsLog("profit_plan", {
      rid: requestId,
      margin: state.margin,
      profit: state.profit,
      strategy,
      singularityTypes: toRun.map((a) => a.type),
      note: "max_two_internal_actions_no_payments_no_pricing",
    });

    const executed = await executeSingularityActions(toRun, {
      rid: requestId,
      experimentSource: "profit_cron",
    });

    opsLog("profit_engine_run", {
      rid: requestId,
      state,
      leaks,
      opportunities,
      strategy,
      executed,
    });

    try {
      await insertAiMemory(supabaseAdmin(), {
        kind: "profit_cycle",
        source_rid: requestId,
        payload: {
          state,
          leaks,
          opportunities,
          strategy,
          actions: prioritized,
          executed,
          metricsSnapshot: {
            conversionRate: metrics.conversionRate,
            revenueGrowth: metrics.revenueGrowth,
            churnRate: metrics.churnRate,
            runningExperimentsCount: metrics.runningExperimentsCount,
          },
        },
      });
      opsLog("profit_memory_stored", { rid: requestId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("profit_memory_store_failed", { rid: requestId, error: message });
    }

    return jsonOk(
      requestId,
      {
        state,
        leaks,
        opportunities,
        strategy,
        executed,
      },
      200,
    );
  });
}

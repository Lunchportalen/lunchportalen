export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeSingularityActions, validateRevenueAction } from "@/lib/ai/automationEngine";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { detectMonetizationGaps } from "@/lib/ai/monetizationGapEngine";
import { generateOffers } from "@/lib/ai/offerEngine";
import { recordRevenueModeCycle } from "@/lib/ai/memory/recordRevenueMode";
import { buildOmniscientContext } from "@/lib/ai/omniscientContext";
import { simulatePricingAdvanced } from "@/lib/ai/pricingSimulationEngine";
import {
  decideRevenueActions,
  toSingularityActionsFromRevenueOffers,
  type RevenueDecisionAction,
} from "@/lib/ai/revenueDecisionEngine";
import { analyzeRevenue } from "@/lib/ai/revenueIntelligenceEngine";
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

async function secondsSinceLastRevenueModeRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("created_at")
      .eq("kind", "revenue_mode_cycle")
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
    const requestId = makeRid("revenue_mode");

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
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "revenue_mode" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.REVENUE_MODE_ENABLED) !== "true") {
      opsLog("revenue_mode_skipped", { rid: requestId, reason: "REVENUE_MODE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "REVENUE_MODE_ENABLED is not true" }, 200);
    }

    const elapsed = await secondsSinceLastRevenueModeRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("revenue_mode_rate_limited", {
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
      opsLog("revenue_mode_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const state = await buildOmniscientContext(metrics);
      const revenueInsights = analyzeRevenue(state);
      const simulations = simulatePricingAdvanced(state);
      const offers = generateOffers(state);
      const gaps = detectMonetizationGaps(state);
      const plannedActions = decideRevenueActions(simulations, offers);
      const blockedActionTypes: string[] = [];
      const allowedForSingularity: RevenueDecisionAction[] = [];
      for (const a of plannedActions) {
        if (validateRevenueAction(a)) allowedForSingularity.push(a);
        else blockedActionTypes.push(String(a.type));
      }
      const singularityPlan = toSingularityActionsFromRevenueOffers(allowedForSingularity).slice(0, MAX_ACTIONS_PER_RUN);

      opsLog("revenue_mode_plan", {
        rid: requestId,
        revenueInsights,
        simulations,
        offers,
        gaps,
        plannedActions,
        blockedActionTypes,
        singularityPlan: singularityPlan.map((a) => a.type),
        maxActions: MAX_ACTIONS_PER_RUN,
      });

      const executed =
        singularityPlan.length > 0
          ? await executeSingularityActions(singularityPlan, {
              rid: requestId,
              experimentSource: "revenue_mode_cron",
            })
          : [];

      const mem = await recordRevenueModeCycle({
        rid: requestId,
        state,
        revenueInsights,
        simulations,
        offers,
        gaps,
        plannedActions,
        blockedActionTypes,
        executed,
      });

      opsLog("revenue_mode_run", {
        rid: requestId,
        simulations,
        offers,
        gaps,
        executed,
        blockedActionTypes,
        memoryRecorded: mem.ok,
        memoryError: mem.ok ? undefined : mem.message,
      });

      return jsonOk(
        requestId,
        {
          revenueInsights,
          simulations,
          offers,
          gaps,
          plannedActions,
          blockedActionTypes,
          executed,
          memoryRecorded: mem.ok,
          ...(mem.ok ? {} : { memoryError: mem.message }),
        },
        200,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("revenue_mode_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}

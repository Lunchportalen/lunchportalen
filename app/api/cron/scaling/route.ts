export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getAttributionData } from "@/lib/ai/attribution/getAttribution";
import { buildAttributionInsights } from "@/lib/ai/attribution/insightEngine";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { buildScalingActions } from "@/lib/ai/scaling/scalingDecisionEngine";
import { reinforceLearning } from "@/lib/ai/scaling/learningLoop";
import { detectLosers } from "@/lib/ai/scaling/loserEngine";
import { mapScalingToSystem } from "@/lib/ai/scaling/scalingMapper";
import { buildScalingState } from "@/lib/ai/scaling/scalingState";
import { detectWinners } from "@/lib/ai/scaling/winnerEngine";
import { executeSingularityActions, validateScalingAction } from "@/lib/ai/automationEngine";
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
    const requestId = rid("scaling");

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

    if (safeTrim(process.env.SCALING_ENGINE_ENABLED) !== "true") {
      opsLog("scaling_skipped", { rid: requestId, reason: "SCALING_ENGINE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "SCALING_ENGINE_ENABLED is not true" }, 200);
    }

    if (!isSystemEnabled()) {
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "scaling" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    const data = await getAttributionData();
    const insights = buildAttributionInsights(data);
    const state = buildScalingState(insights);

    const winners = detectWinners(insights.roi);
    const losers = detectLosers(insights.roi);

    const scalingActions = buildScalingActions(winners, losers);
    for (const a of scalingActions) {
      validateScalingAction(a);
    }

    const reinforcements = reinforceLearning(winners);
    opsLog("scaling_reinforcement", { rid: requestId, reinforcements });

    const systemActions = mapScalingToSystem(scalingActions);
    const toRun = systemActions.slice(0, 2);

    opsLog("scaling_plan", {
      rid: requestId,
      winnerCount: winners.length,
      loserCount: losers.length,
      scalingActionCount: scalingActions.length,
      singularityPlanned: toRun.map((a) => a.type),
      note: "max_two_internal_actions_no_spend",
    });

    const executed = await executeSingularityActions(toRun, {
      rid: requestId,
      experimentSource: "scaling_cron",
    });

    opsLog("scaling_run", {
      rid: requestId,
      winners,
      losers,
      scalingActions,
      executed,
    });

    try {
      await insertAiMemory(supabaseAdmin(), {
        kind: "scaling_cycle",
        source_rid: requestId,
        payload: {
          winners,
          losers,
          actions: scalingActions,
          reinforcements,
          executed,
          state,
        },
      });
      opsLog("scaling_memory_stored", { rid: requestId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("scaling_memory_store_failed", { rid: requestId, error: message });
    }

    return jsonOk(
      requestId,
      {
        winners,
        losers,
        reinforcements,
        executed,
        singularityActionCount: toRun.length,
        scalingPlanActionCount: scalingActions.length,
      },
      200,
    );
  });
}

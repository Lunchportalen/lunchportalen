export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { validateOmniscientAction } from "@/lib/ai/automationEngine";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { suggestExpansion } from "@/lib/ai/expansionEngine";
import { detectMarketOpportunities } from "@/lib/ai/marketOpportunityEngine";
import { rankMarketMoves } from "@/lib/ai/marketRankingEngine";
import { simulateMarket } from "@/lib/ai/marketSimulationEngine";
import { recordOmniscientCycle } from "@/lib/ai/memory/recordOmniscient";
import { buildOmniscientContext } from "@/lib/ai/omniscientContext";
import { buildOmniscientFeedForGrowthEngines, decideOmniscientActions } from "@/lib/ai/omniscientDecisionEngine";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

const RATE_LIMIT_SEC = 300;

function safeTrim(v: unknown) {
  return String(v ?? "").trim();
}

async function secondsSinceLastOmniscientRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("created_at")
      .eq("kind", "omniscient_cycle")
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
    const requestId = makeRid("omniscient");

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

    if (safeTrim(process.env.OMNISCIENT_ENABLED) !== "true") {
      opsLog("omniscient_skipped", { rid: requestId, reason: "OMNISCIENT_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "OMNISCIENT_ENABLED is not true" }, 200);
    }

    const elapsed = await secondsSinceLastOmniscientRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("omniscient_rate_limited", {
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
      opsLog("omniscient_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const state = await buildOmniscientContext(metrics);
      const simulations = simulateMarket(state);
      const opportunities = detectMarketOpportunities(state, simulations);
      const ranked = rankMarketMoves(opportunities);
      const expansion = suggestExpansion(state);
      const actions = decideOmniscientActions(ranked, expansion);
      const { hints } = buildOmniscientFeedForGrowthEngines(ranked, expansion);
      const actionsSafeForAutomation = actions.filter(validateOmniscientAction);

      const mem = await recordOmniscientCycle({
        rid: requestId,
        state,
        simulations,
        opportunities,
        ranked,
        expansion,
        actions,
        hints,
      });

      opsLog("omniscient_run", {
        rid: requestId,
        ranked,
        expansion,
        actions,
        hints,
        actionsSafeForAutomation,
        memoryRecorded: mem.ok,
        memoryError: mem.ok ? undefined : mem.message,
      });

      return jsonOk(
        requestId,
        {
          ranked,
          expansion,
          actions,
          hints,
          actionsSafeForAutomation,
          simulations,
          opportunities,
          memoryRecorded: mem.ok,
          ...(mem.ok ? {} : { memoryError: mem.message }),
        },
        200,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("omniscient_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}

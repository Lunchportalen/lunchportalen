export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeMarketActions } from "@/lib/ai/automationEngine";
import { analyzeCompetitors } from "@/lib/ai/market/competitorEngine";
import { decideMarketActions } from "@/lib/ai/market/marketDecisionEngine";
import { buildMarketContext } from "@/lib/ai/market/marketContext";
import { detectMarketGaps } from "@/lib/ai/market/gapEngine";
import { getMarketMetrics } from "@/lib/ai/market/getMarketMetrics";
import { suggestExpansion } from "@/lib/ai/market/expansionEngine";
import { determinePosition } from "@/lib/ai/market/positioningEngine";
import { simulatePricing } from "@/lib/ai/market/pricingStrategyEngine";
import { recordMarketCycle } from "@/lib/ai/memory/recordMarketCycle";
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

async function secondsSinceLastMarketRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("created_at")
      .eq("kind", "market_cycle")
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
    const requestId = makeRid("market");

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
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "market" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.MARKET_MODE_ENABLED) !== "true") {
      opsLog("market_skipped", { rid: requestId, reason: "MARKET_MODE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "MARKET_MODE_ENABLED is not true" }, 200);
    }

    const elapsed = await secondsSinceLastMarketRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("market_rate_limited", {
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
      metrics = await getMarketMetrics();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("market_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const ctx = buildMarketContext(metrics);
      const competitorInsights = analyzeCompetitors(ctx);
      const gaps = detectMarketGaps(ctx);
      const position = determinePosition(ctx, competitorInsights);
      const pricing = simulatePricing({ position }, ctx);
      const expansion = suggestExpansion(ctx, gaps);
      const actions = decideMarketActions(expansion);

      opsLog("market_plan", {
        rid: requestId,
        context: ctx,
        competitorInsights,
        gaps,
        position,
        pricing,
        expansion,
        actions,
      });

      const executed = await executeMarketActions(actions, {
        rid: requestId,
        experimentSource: "market_cron",
      });

      const mem = await recordMarketCycle({
        rid: requestId,
        context: ctx,
        competitorInsights,
        gaps,
        position,
        pricingSuggestions: pricing,
        expansion,
        decidedActions: actions,
        executed,
      });

      opsLog("market_run", {
        rid: requestId,
        competitorInsights,
        gaps,
        position,
        pricing,
        expansion,
        executed,
        memoryRecorded: mem.ok,
        memoryError: mem.ok ? undefined : mem.message,
      });

      return jsonOk(
        requestId,
        {
          competitorInsights,
          gaps,
          position,
          pricing,
          expansion,
          actions,
          executed,
          memoryRecorded: mem.ok,
          ...(mem.ok ? {} : { memoryError: mem.message }),
        },
        200,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("market_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}

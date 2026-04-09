export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeMarketActions } from "@/lib/ai/automationEngine";
import { buildBusinessState } from "@/lib/ai/businessStateEngine";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { buildMarketContext } from "@/lib/ai/market/marketContext";
import { getMarketMetrics } from "@/lib/ai/market/getMarketMetrics";
import { recordMonopolyCycle } from "@/lib/ai/memory/recordMonopolyCycle";
import { mapMonopolyActions } from "@/lib/ai/monopoly/actionMapper";
import { defineCategory } from "@/lib/ai/monopoly/categoryEngine";
import { evaluateThreats } from "@/lib/ai/monopoly/competitionEngine";
import { controlDemand } from "@/lib/ai/monopoly/demandEngine";
import { buildLockIn } from "@/lib/ai/monopoly/lockInEngine";
import { amplifyNetworkEffects } from "@/lib/ai/monopoly/networkEffectEngine";
import { buildMonopolyStrategy } from "@/lib/ai/monopoly/strategyEngine";
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

async function secondsSinceLastMonopolyRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("created_at")
      .eq("kind", "monopoly_cycle")
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
    const requestId = makeRid("monopoly");

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
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "monopoly" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.MONOPOLY_MODE_ENABLED) !== "true") {
      opsLog("monopoly_skipped", { rid: requestId, reason: "MONOPOLY_MODE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "MONOPOLY_MODE_ENABLED is not true" }, 200);
    }

    const elapsed = await secondsSinceLastMonopolyRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("monopoly_rate_limited", {
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
    let market;
    try {
      [metrics, market] = await Promise.all([getBusinessMetrics(), getMarketMetrics()]);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("monopoly_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const state = buildBusinessState(metrics);
      const ctx = buildMarketContext(market);

      const category = defineCategory(ctx);
      const demand = controlDemand(state);
      const lockIn = buildLockIn(state);
      const effects = amplifyNetworkEffects(state);
      const threats = evaluateThreats(ctx);

      const strategy = buildMonopolyStrategy(category, demand, lockIn, effects, threats);
      const actions = mapMonopolyActions(strategy);

      opsLog("monopoly_plan", {
        rid: requestId,
        category,
        demand,
        lockIn,
        effects,
        threats,
        strategy,
        actions,
      });

      const executed = await executeMarketActions(actions, {
        rid: requestId,
        experimentSource: "monopoly_cron",
      });

      const mem = await recordMonopolyCycle({
        rid: requestId,
        category,
        demand,
        lockIn,
        effects,
        threats,
        strategy,
        actions,
        executed,
      });

      opsLog("monopoly_run", {
        rid: requestId,
        category,
        demand,
        lockIn,
        effects,
        threats,
        strategy,
        executed,
        memoryRecorded: mem.ok,
        memoryError: mem.ok ? undefined : mem.message,
      });

      return jsonOk(
        requestId,
        {
          category,
          demand,
          lockIn,
          effects,
          threats,
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
      opsLog("monopoly_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}

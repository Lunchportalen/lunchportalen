export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { executeSingularityActions } from "@/lib/ai/automationEngine";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { buildBusinessState } from "@/lib/ai/businessStateEngine";
import { decideActions } from "@/lib/ai/businessDecisionEngine";
import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { buildGrowthStrategy } from "@/lib/ai/growthStrategyEngine";
import { recordSingularity } from "@/lib/ai/memory/recordSingularity";
import { suggestPricing } from "@/lib/ai/pricingEngine";
import { detectRevenueLeaks } from "@/lib/ai/revenueLeakEngine";
import type { SingularityActionWithScore } from "@/lib/ai/prioritizationEngine";
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

function dedupeSingularityActionsByType(actions: SingularityActionWithScore[]): SingularityActionWithScore[] {
  const seen = new Set<string>();
  const out: SingularityActionWithScore[] = [];
  for (const a of actions) {
    if (seen.has(a.type)) continue;
    seen.add(a.type);
    out.push(a);
  }
  return out;
}

async function secondsSinceLastGodModeRun(): Promise<number | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("created_at")
      .eq("kind", "god_mode_cycle")
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
    const requestId = makeRid("god_mode");

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
      opsLog("ai_cron_kill_switch", { rid: requestId, route: "god_mode" });
      return jsonOk(requestId, { skipped: true, reason: "kill_switch" }, 200);
    }

    if (safeTrim(process.env.GOD_MODE_ENABLED) !== "true") {
      opsLog("god_mode_skipped", { rid: requestId, reason: "GOD_MODE_ENABLED not true" });
      return jsonOk(requestId, { skipped: true, reason: "GOD_MODE_ENABLED is not true" }, 200);
    }

    const elapsed = await secondsSinceLastGodModeRun();
    if (elapsed != null && elapsed < RATE_LIMIT_SEC) {
      opsLog("god_mode_rate_limited", {
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
      opsLog("god_mode_metrics_failed", { rid: requestId, message });
      return jsonErr(requestId, message, 500, "METRICS_FAILED");
    }

    try {
      const state = buildBusinessState(metrics);
      const leaks = detectRevenueLeaks(state);
      const pricing = suggestPricing(state);
      const strategy = buildGrowthStrategy(state, leaks);
      const rawActions = decideActions(strategy);
      const actions = dedupeSingularityActionsByType(rawActions).slice(0, MAX_ACTIONS_PER_RUN);

      opsLog("god_mode_plan", {
        rid: requestId,
        state,
        leaks,
        pricing,
        strategy,
        actionTypes: actions.map((a) => a.type),
        maxActions: MAX_ACTIONS_PER_RUN,
      });

      const executed = await executeSingularityActions(actions, {
        rid: requestId,
        experimentSource: "god_mode_cron",
      });

      const mem = await recordSingularity({
        rid: requestId,
        state,
        leaks,
        pricing,
        strategy,
        executed,
      });

      opsLog("god_mode_run", {
        rid: requestId,
        leaks,
        pricing,
        strategy,
        executed,
        memoryRecorded: mem.ok,
        memoryError: mem.ok ? undefined : mem.message,
      });

      return jsonOk(
        requestId,
        {
          leaks,
          pricing,
          strategy,
          executed,
          memoryRecorded: mem.ok,
          ...(mem.ok ? {} : { memoryError: mem.message }),
        },
        200,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      opsLog("god_mode_error", { rid: requestId, error: message });
      return jsonOk(requestId, { error: "safe_fail", message }, 200);
    }
  });
}

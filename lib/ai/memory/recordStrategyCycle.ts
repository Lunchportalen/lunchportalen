/**
 * Audit row for the strategic cron (context → pillars → roadmap → prioritize → execute ≤2 → learn).
 */

import "server-only";

import type { StrategicPlanExecutionRow } from "@/lib/ai/automationEngine";
import type { RoadmapStep } from "@/lib/ai/roadmapEngine";
import type { StrategicContext } from "@/lib/ai/strategicContext";
import type { StrategyPillar } from "@/lib/ai/strategyEngine";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordStrategyCycleOpts = {
  rid: string;
  ctx: StrategicContext;
  strategy: StrategyPillar[];
  roadmap: RoadmapStep[];
  results: StrategicPlanExecutionRow[];
};

export async function recordStrategyCycle(
  opts: RecordStrategyCycleOpts,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "strategy_cycle",
      source_rid: opts.rid,
      payload: {
        ctx: opts.ctx,
        strategy: opts.strategy,
        roadmap: opts.roadmap,
        results: opts.results,
      },
    });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("record_strategy_cycle_failed", { rid: opts.rid, message });
    return { ok: false, message };
  }
}

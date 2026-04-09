/**
 * Writes conversion-based outcomes to ai_memory for experience-driven scoring (append-only).
 * Does not replace {@link recordLearning} (ai_learning) — separate audit stream.
 */

import "server-only";

import type { BusinessMetricsSnapshot } from "@/lib/ai/businessMetrics";
import type { SingularityExecuteResult } from "@/lib/ai/automationEngine";
import { evaluateOutcome } from "@/lib/ai/outcomeEvaluator";
import type { GlobalIntelligenceContext } from "@/lib/ai/globalIntelligence";
import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type RecordSingularityOutcomeOpts = {
  rid: string;
  beforeCtx: GlobalIntelligenceContext;
  beforeMetrics: BusinessMetricsSnapshot;
  afterMetrics: BusinessMetricsSnapshot;
  executed: SingularityExecuteResult[];
};

/**
 * One ai_memory row per executed step type so experiment / variant / optimize accumulate separate sample counts.
 */
export async function recordSingularityOutcome(opts: RecordSingularityOutcomeOpts): Promise<void> {
  const before = { conversion: opts.beforeCtx.conversion };
  const after = { conversion: opts.afterMetrics.conversionRate };
  const { success, outcome_score } = evaluateOutcome(before, after);

  const steps = (Array.isArray(opts.executed) ? opts.executed : []).filter((s) => s.status === "executed");
  if (steps.length === 0) {
    opsLog("outcome_learning_skipped", { rid: opts.rid, reason: "no_successful_executed_steps" });
    return;
  }

  const supabase = supabaseAdmin();
  for (const step of steps) {
    try {
      await insertAiMemory(supabase, {
        kind: "outcome",
        source_rid: opts.rid,
        action_type: step.type,
        outcome_score,
        success,
        payload: {
          source: "singularity_cron",
          step,
          beforeContext: opts.beforeCtx,
          beforeMetrics: opts.beforeMetrics,
          afterMetrics: opts.afterMetrics,
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      opsLog("outcome_learning_insert_failed", { rid: opts.rid, type: step.type, message });
    }
  }
  opsLog("outcome_learning_recorded", {
    rid: opts.rid,
    rows: steps.length,
    success,
    outcome_score,
  });
}

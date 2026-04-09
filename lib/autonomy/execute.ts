import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidateTag } from "next/cache";

import { CONTROL_TOWER_CACHE_TAG } from "@/lib/controlTower/aggregator";
import { buildHypothesis, type PostMetricsInput } from "@/lib/experiment/hypothesis";
import { runGrowthCopyExperiment } from "@/lib/experiment/growthExperiment";
import type { GrowthMetrics } from "@/lib/experiment/measure";
import { processOutboxBatch } from "@/lib/orderBackup/outbox";
import { generateSequenceVariant } from "@/lib/sales/generateSequenceVariant";
import { improveSequence } from "@/lib/sales/improveSequence";
import { runSequenceEngine } from "@/lib/sales/runSequence";
import { saveSequenceVariant } from "@/lib/sales/sequenceVariant";
import { opsLog } from "@/lib/ops/log";

import type { ScoredAutonomyAction } from "@/lib/autonomy/growthTypes";

import type { ExecutionResult, MappedActionType, MappedAutonomyAction } from "./types";

import { canExecute } from "./policy";
import type { AutonomyConfigResolved } from "./config";

export type AutonomyExecuteGrowthContext = {
  pageId: string;
  locale: string;
  aiCtx: { companyId: string; userId: string };
  metricsBefore: GrowthMetrics;
  createdBy: string | null;
  postMetrics?: PostMetricsInput;
};

export async function executeAutonomyActions(
  actions: MappedAutonomyAction[],
  ctx: {
    rid: string;
    config: AutonomyConfigResolved;
    approved: ReadonlySet<MappedActionType>;
    dryRun: boolean;
    admin: SupabaseClient;
    growth?: AutonomyExecuteGrowthContext | null;
  }
): Promise<ExecutionResult[]> {
  const results: ExecutionResult[] = [];
  let growthCopyConsumed = false;

  for (const a of actions) {
    if (ctx.dryRun) {
      results.push({ ...a, status: "would_execute", detail: "dry_run" });
      continue;
    }

    const pol = canExecute(a, ctx.config, ctx.approved);
    if (pol.ok === false) {
      results.push({ ...a, status: "blocked", detail: pol.reason });
      continue;
    }

    try {
      switch (a.type) {
        case "observe": {
          opsLog("autonomy_observe", { rid: ctx.rid, message: a.reason });
          results.push({ ...a, status: "executed", detail: "logged" });
          break;
        }
        case "retry_jobs": {
          const r = await processOutboxBatch(12, { rid: ctx.rid, worker: `autonomy:${ctx.rid}` });
          opsLog("autonomy_retry_jobs", { rid: ctx.rid, processed: r.processed });
          results.push({ ...a, status: "executed", detail: `processed=${r.processed}` });
          break;
        }
        case "update_copy": {
          if (ctx.growth && !growthCopyConsumed) {
            growthCopyConsumed = true;
            const r = await runGrowthCopyExperiment({
              admin: ctx.admin,
              pageId: ctx.growth.pageId,
              locale: ctx.growth.locale,
              rid: ctx.rid,
              aiCtx: ctx.growth.aiCtx,
              createdBy: ctx.growth.createdBy,
              metricsBefore: ctx.growth.metricsBefore,
              postMetrics: ctx.growth.postMetrics,
            });
            revalidateTag(CONTROL_TOWER_CACHE_TAG);
            if (r.ok === false) {
              opsLog("autonomy_update_copy_growth_failed", { rid: ctx.rid, error: r.error });
              results.push({ ...a, status: "failed", detail: r.error });
            } else {
              opsLog("autonomy_update_copy_growth", {
                rid: ctx.rid,
                experimentId: r.experimentId,
                versionNumber: r.versionNumber,
              });
              results.push({
                ...a,
                status: "executed",
                detail: `growth_experiment=${r.experimentId} v=${r.versionNumber}`,
              });
            }
          } else {
            revalidateTag(CONTROL_TOWER_CACHE_TAG);
            opsLog("autonomy_update_copy_cache", { rid: ctx.rid, tag: CONTROL_TOWER_CACHE_TAG });
            results.push({ ...a, status: "executed", detail: "revalidateTag_only" });
          }
          break;
        }
        case "adjust_sequence": {
          const seq = await runSequenceEngine(ctx.rid);
          opsLog("autonomy_adjust_sequence", { rid: ctx.rid, ok: seq.ok, processed: seq.processed });
          if (!seq.ok) {
            results.push({ ...a, status: "failed", detail: seq.error ?? "sequence_failed" });
            break;
          }
          if (ctx.growth && seq.processed > 0) {
            const snapshot = {
              engine: "run_sequence",
              processed: seq.processed,
              drafts: seq.drafts,
              skippedDailyCap: seq.skippedDailyCap,
            };
            try {
              const improved =
                ctx.growth.postMetrics != null
                  ? await generateSequenceVariant(
                      snapshot,
                      buildHypothesis(ctx.growth.postMetrics),
                      ctx.growth.aiCtx
                    )
                  : await improveSequence(snapshot, ctx.growth.aiCtx);
              await saveSequenceVariant(ctx.admin, {
                rid: ctx.rid,
                original: snapshot,
                improved,
              });
              opsLog("autonomy_sequence_variant_saved", { rid: ctx.rid, processed: seq.processed });
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              opsLog("autonomy_sequence_improve_failed", { rid: ctx.rid, message: msg });
            }
          }
          results.push({ ...a, status: "executed", detail: `drafts=${seq.drafts.length}` });
          break;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      opsLog("autonomy_action_failed", { rid: ctx.rid, type: a.type, message: msg });
      results.push({ ...a, status: "failed", detail: msg });
    }
  }

  return results;
}

/**
 * ML-/growth-orkestrator: ingen persistert sideeffekt (fail-closed).
 * @see `lib/autonomy/orchestrator.ts`
 */
export async function execute(
  _sb: SupabaseClient,
  _action: ScoredAutonomyAction,
): Promise<{ success: boolean }> {
  return { success: false };
}

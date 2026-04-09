import "server-only";

import { revalidateTag } from "next/cache";

import { CONTROL_TOWER_CACHE_TAG } from "@/lib/controlTower/aggregator";
import { processOutboxBatch, resetStaleProcessing } from "@/lib/orderBackup/outbox";
import { opsLog } from "@/lib/ops/log";

import type { SelfHealConfig } from "./config";
import type { RemediationActionType, RemediationPlanItem } from "./playbook";

export type RemediationResult = {
  action: RemediationActionType;
  status: "executed" | "skipped" | "failed";
  detail?: string;
};

function allowed(config: SelfHealConfig, type: RemediationActionType): boolean {
  if (type === "db_migration") return false;
  return config.allow[type] === true;
}

/**
 * Server-side only: no HTTP self-fetch. Idempotent where possible; policy-gated.
 */
export async function executeRemediation(
  actions: RemediationPlanItem[],
  ctx: { rid: string; config: SelfHealConfig }
): Promise<RemediationResult[]> {
  const results: RemediationResult[] = [];

  for (const action of actions) {
    if (!allowed(ctx.config, action.type)) {
      opsLog("self_heal_action_skipped_policy", { rid: ctx.rid, action: action.type });
      results.push({ action: action.type, status: "skipped", detail: "policy_denied" });
      continue;
    }

    if (action.type === "db_migration") {
      opsLog("self_heal_blocked_db_migration", { rid: ctx.rid });
      results.push({ action: action.type, status: "skipped", detail: "never_auto" });
      continue;
    }

    if (action.type === "scale_workers") {
      opsLog("self_heal_blocked_scale_workers", { rid: ctx.rid });
      results.push({ action: action.type, status: "skipped", detail: "unsafe_default_off" });
      continue;
    }

    try {
      switch (action.type) {
        case "restart_jobs": {
          const resetStale = await resetStaleProcessing(10);
          opsLog("self_heal_restart_jobs", { rid: ctx.rid, resetStale });
          results.push({
            action: action.type,
            status: "executed",
            detail: `resetStale=${resetStale}`,
          });
          break;
        }
        case "retry_outbox": {
          const r = await processOutboxBatch(15, {
            rid: ctx.rid,
            worker: `self-heal:${ctx.rid}`,
          });
          opsLog("self_heal_retry_outbox", { rid: ctx.rid, processed: r.processed, sent: r.sent });
          results.push({
            action: action.type,
            status: "executed",
            detail: `processed=${r.processed}`,
          });
          break;
        }
        case "clear_locks": {
          const resetStale = await resetStaleProcessing(10);
          opsLog("self_heal_clear_locks", { rid: ctx.rid, resetStale });
          results.push({
            action: action.type,
            status: "executed",
            detail: `resetStale=${resetStale}`,
          });
          break;
        }
        case "rebuild_cache": {
          revalidateTag(CONTROL_TOWER_CACHE_TAG);
          opsLog("self_heal_rebuild_cache", { rid: ctx.rid, tag: CONTROL_TOWER_CACHE_TAG });
          results.push({
            action: action.type,
            status: "executed",
            detail: "revalidateTag",
          });
          break;
        }
        case "notify_human": {
          opsLog("self_heal_notify_human", {
            rid: ctx.rid,
            note: "Business anomaly — review monitoring + revenue context.",
          });
          results.push({ action: action.type, status: "executed", detail: "logged" });
          break;
        }
        default: {
          results.push({ action: action.type, status: "skipped", detail: "unhandled" });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      opsLog("self_heal_action_failed", { rid: ctx.rid, action: action.type, message: msg });
      results.push({ action: action.type, status: "failed", detail: msg });
    }
  }

  return results;
}

import "server-only";

import { revalidateTag } from "next/cache";

import { CONTROL_TOWER_CACHE_TAG } from "@/lib/controlTower/aggregator";
import { opsLog } from "@/lib/ops/log";

import type { RemediationActionType } from "./playbook";

/**
 * Best-effort rollback: many actions are irreversible (outbox sends). Safe ops are idempotent.
 */
export async function rollbackAction(
  actionType: RemediationActionType,
  ctx: { rid: string }
): Promise<{ status: "noop" | "retried" | "skipped"; detail?: string }> {
  if (actionType === "rebuild_cache") {
    try {
      revalidateTag(CONTROL_TOWER_CACHE_TAG);
      opsLog("self_heal_rollback_cache_revalidate", { rid: ctx.rid });
      return { status: "retried", detail: "revalidateTag control-tower" };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      opsLog("self_heal_rollback_cache_failed", { rid: ctx.rid, message: msg });
      return { status: "skipped", detail: msg };
    }
  }

  if (actionType === "restart_jobs" || actionType === "retry_outbox" || actionType === "clear_locks") {
    opsLog("self_heal_rollback_noop_irreversible", { rid: ctx.rid, actionType });
    return { status: "noop", detail: "outbox/stale operations are not reversible" };
  }

  if (actionType === "notify_human") {
    return { status: "noop", detail: "notify only" };
  }

  opsLog("self_heal_rollback_skipped", { rid: ctx.rid, actionType });
  return { status: "skipped", detail: "no rollback handler" };
}

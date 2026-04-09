import "server-only";

import { getPolicy } from "@/lib/ai/policy";
import { isAutoMode } from "@/lib/automation/isAutoMode";
import { auditLog } from "@/lib/core/audit";
import { getQueue, updateAction, type ExecutionAction } from "@/lib/execution/queue";
import { opsLog } from "@/lib/ops/log";

function safeMeta(a: ExecutionAction): Record<string, unknown> {
  return {
    id: a.id,
    type: a.type,
    status: a.status,
    payload:
      a.payload && typeof a.payload === "object"
        ? JSON.stringify(a.payload).slice(0, 2000)
        : String(a.payload ?? "").slice(0, 500),
  };
}

function selectRunnable(actions: ExecutionAction[]): ExecutionAction[] {
  if (!isAutoMode()) {
    return actions.filter((a) => a.status === "approved");
  }
  return actions.filter((a) => {
    if (a.status === "executed") return false;
    if (a.status === "approved") return true;
    if (a.status === "pending") {
      return getPolicy(a) === "auto";
    }
    return false;
  });
}

/**
 * Kjør godkjente handlinger; med AI_AUTO_MODE=true også «auto»-policy for pending (kun analyze/log/score).
 */
export async function runExecutionCycle(): Promise<{ processed: number; autoMode: boolean }> {
  const queue = getQueue();
  const candidates = selectRunnable(queue);
  let processed = 0;
  const autoMode = isAutoMode();

  for (const action of candidates) {
    const wasPending = action.status === "pending";
    const auditName =
      autoMode && wasPending && getPolicy(action) === "auto" ? "auto_execution" : "action_executed";

    try {
      const ok = updateAction(action.id, { status: "executed" });
      if (!ok) {
        await auditLog({
          action: "action_execution_failed",
          entity: action.type,
          metadata: { ...safeMeta(action), reason: "status_update_failed" },
        });
        opsLog("execution_run_update_failed", { id: action.id });
        continue;
      }

      processed += 1;
      await auditLog({
        action: auditName,
        entity: action.type,
        metadata: safeMeta({ ...action, status: "executed" }),
      });
    } catch (e) {
      await auditLog({
        action: "action_execution_failed",
        entity: action.type,
        metadata: {
          ...safeMeta(action),
          error: e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500),
        },
      });
      opsLog("execution_run_exception", { id: action.id, message: e instanceof Error ? e.message : String(e) });
    }
  }

  return { processed, autoMode };
}

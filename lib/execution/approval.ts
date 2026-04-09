import "server-only";

import { auditLog } from "@/lib/core/audit";
import { getActionById, updateAction } from "@/lib/execution/queue";
import { opsLog } from "@/lib/ops/log";

export type ApproveResult = { ok: true } | { ok: false; reason: string };

/**
 * Eksplisitt godkjenning — ingen kjøring her.
 */
export async function approveAction(id: string): Promise<ApproveResult> {
  const sid = String(id ?? "").trim();
  if (!sid) {
    await auditLog({
      action: "action_approve_rejected",
      entity: "execution",
      metadata: { reason: "missing_id" },
    });
    return { ok: false, reason: "MISSING_ID" };
  }

  const cur = getActionById(sid);
  if (!cur) {
    opsLog("execution_approve_unknown_id", { id: sid });
    await auditLog({
      action: "action_approve_rejected",
      entity: "execution",
      metadata: { id: sid, reason: "unknown_id" },
    });
    return { ok: false, reason: "UNKNOWN_ID" };
  }

  if (cur.status !== "pending") {
    await auditLog({
      action: "action_approve_rejected",
      entity: "execution",
      metadata: { id: sid, reason: "invalid_state", status: cur.status },
    });
    return { ok: false, reason: "INVALID_STATE" };
  }

  const updated = updateAction(sid, { status: "approved" });
  if (!updated) {
    await auditLog({
      action: "action_approve_rejected",
      entity: "execution",
      metadata: { id: sid, reason: "update_failed" },
    });
    return { ok: false, reason: "UPDATE_FAILED" };
  }

  await auditLog({
    action: "action_approved",
    entity: "execution",
    metadata: { id: sid, type: cur.type },
  });

  return { ok: true };
}

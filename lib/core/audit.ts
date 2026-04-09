import "server-only";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { scheduleAuditEvent } from "@/lib/security/audit";

/**
 * Global audit hook — uses existing `audit_logs` pipeline (service role, never throws).
 * Call from server routes/actions; failures are logged via ops inside `scheduleAuditEvent`.
 */
export async function auditLog(event: {
  action: string;
  entity?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const ctx = await getAuthContext();
    const userId = ctx.userId ?? null;
    const companyId = ctx.company_id ?? null;
    const action = String(event.action ?? "").trim() || "unknown";
    const resource = String(event.entity ?? "").trim() || "unknown";

    scheduleAuditEvent({
      companyId,
      userId,
      action,
      resource,
      metadata: {
        ...(event.metadata && typeof event.metadata === "object" ? event.metadata : {}),
        source: "lib.core.audit",
        actor_role: ctx.role ?? null,
      },
    });
  } catch {
    /* never break primary flow */
  }
}

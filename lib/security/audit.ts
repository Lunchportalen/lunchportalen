// lib/security/audit.ts
import "server-only";

import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

export type AuditEventInput = {
  companyId: string | null;
  userId: string | null;
  action: string;
  resource: string;
  metadata?: Record<string, unknown>;
};

/**
 * Persist audit row (async). Callers should use scheduleAuditEvent() so requests never await this.
 * On failure: logs to ops (never silent).
 */
export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  const action = String(input.action ?? "").trim();
  const resource = String(input.resource ?? "").trim();
  if (!action || !resource) {
    opsLog("security_audit_invalid_input", { input });
    return;
  }

  if (!hasSupabaseAdminConfig()) {
    opsLog("security_audit_no_admin_config", {
      action,
      resource,
      companyId: input.companyId,
      userId: input.userId,
    });
    return;
  }

  try {
    const admin = supabaseAdmin();
    const { error } = await admin.from("audit_logs").insert({
      company_id: input.companyId,
      user_id: input.userId,
      action,
      resource,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    });
    if (error) {
      opsLog("security_audit_insert_failed", {
        action,
        resource,
        companyId: input.companyId,
        userId: input.userId,
        error: error.message,
        code: error.code,
      });
    }
  } catch (e) {
    opsLog("security_audit_insert_exception", {
      action,
      resource,
      companyId: input.companyId,
      userId: input.userId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Non-blocking audit write. Does not throw; failures are recorded via opsLog inside logAuditEvent.
 */
export function scheduleAuditEvent(input: AuditEventInput): void {
  void logAuditEvent(input);
}

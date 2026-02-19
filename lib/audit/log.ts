// lib/audit/log.ts
import { supabaseAdmin } from "@/lib/supabase/admin";

/* =========================================================
   Types
========================================================= */

export type Severity = "info" | "warning" | "critical";

export type AuditWriteInput = {
  actor_user_id: string;
  actor_role: string;
  action: string;
  severity?: Severity;

  company_id?: string | null;

  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;

  before?: any;
  after?: any;
  meta?: any;
};

/* =========================================================
   Supabase (service role)
========================================================= */

function getSupabaseAdmin() {
  try {
    return supabaseAdmin();
  } catch {
    // Fail-quiet: audit skal aldri knekke drift
    return null;
  }
}

/* =========================================================
   Write audit event
========================================================= */

export async function writeAudit(opts: AuditWriteInput): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return; // silent skip (enterprise rule)

  try {
    await admin.from("audit_log").insert({
      actor_user_id: opts.actor_user_id,
      actor_role: opts.actor_role,
      action: opts.action,
      severity: opts.severity ?? "info",

      company_id: opts.company_id ?? null,

      target_type: opts.target_type ?? null,
      target_id: opts.target_id ?? null,
      target_label: opts.target_label ?? null,

      before: opts.before ?? null,
      after: opts.after ?? null,
      meta: opts.meta ?? null,
    });
  } catch (err: any) {
    // Audit skal ALDRI kaste feil videre
    // Logges kun i server-logs for diagnose
    console.error("[audit] write failed", {
      message: err?.message ?? err,
      action: opts.action,
      actor: opts.actor_user_id,
    });
  }
}

/* =========================================================
   Convenience helpers (valgfritt, anbefalt bruk)
========================================================= */

/**
 * Kort helper for vanlige admin-handlinger
 */
export async function auditAdminAction(params: {
  actor_user_id: string;
  company_id: string | null;
  action: string;
  target_type?: string;
  target_id?: string;
  target_label?: string;
  before?: any;
  after?: any;
  meta?: any;
}) {
  return writeAudit({
    actor_user_id: params.actor_user_id,
    actor_role: "company_admin",
    action: params.action,
    severity: "info",
    company_id: params.company_id,
    target_type: params.target_type ?? null,
    target_id: params.target_id ?? null,
    target_label: params.target_label ?? null,
    before: params.before,
    after: params.after,
    meta: params.meta,
  });
}

/**
 * Kritiske systemhendelser
 */
export async function auditCritical(params: {
  actor_user_id: string;
  actor_role: string;
  action: string;
  company_id?: string | null;
  meta?: any;
}) {
  return writeAudit({
    actor_user_id: params.actor_user_id,
    actor_role: params.actor_role,
    action: params.action,
    severity: "critical",
    company_id: params.company_id ?? null,
    meta: params.meta,
  });
}

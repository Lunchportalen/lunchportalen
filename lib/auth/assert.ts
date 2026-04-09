import "server-only";

import { auditLog, buildAuditEvent } from "@/lib/audit/log";
import type { AuthContext } from "@/lib/auth/getAuthContext";
import { authLog } from "@/lib/auth/log";
import { canAccessCompany } from "@/lib/auth/guards";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

/**
 * Server-side tenant check — never trust client-supplied company id without this (or equivalent).
 * Delegates to canAccessCompany (superadmin / kitchen / driver rules preserved).
 */
export function assertTenant(ctx: AuthContext, companyId: string | null | undefined): boolean {
  const cid = safeTrim(companyId);
  if (!cid) return false;
  if (!ctx.sessionOk) return false;
  return canAccessCompany(ctx, cid);
}

export function logTenantViolation(
  rid: string,
  requestedCompanyId: string | null | undefined,
  ctx: AuthContext
): void {
  authLog(rid, "tenant_violation_attempt", {
    requestedCompanyId: safeTrim(requestedCompanyId) || null,
    ctxCompanyId: ctx.company_id,
    role: ctx.role,
  });
  auditLog(
    buildAuditEvent(ctx, {
      action: "TENANT_VIOLATION",
      resource: "tenant",
      metadata: { requestedCompanyId: safeTrim(requestedCompanyId) || null },
    }),
  );
}

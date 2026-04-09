import "server-only";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { throwError } from "@/lib/core/errors";

/**
 * Roles that must carry `profiles.company_id` for tenant isolation (server truth).
 * Superadmin is intentionally excluded — no single tenant scope.
 */
const TENANT_BOUND_ROLES = new Set(["company_admin", "employee", "kitchen", "driver"]);

/**
 * Returns auth `company_id` when present. Does not throw.
 */
export async function getAuthCompanyId(): Promise<string | null> {
  const ctx = await getAuthContext();
  return ctx.company_id;
}

/**
 * Fail-closed: if the user is tenant-bound, `company_id` must exist.
 * Superadmin returns `null` (caller must use superadmin-scoped queries, not cross-tenant data).
 */
export async function requireCompanyIdForTenantBoundRole(): Promise<string | null> {
  const ctx = await getAuthContext();
  if (ctx.role === "superadmin") return null;
  if (ctx.role && TENANT_BOUND_ROLES.has(ctx.role) && !ctx.company_id) {
    throwError({
      code: "TENANT_REQUIRED",
      message: "Mangler firmascope (company_id).",
      source: "tenantGuard",
      severity: "high",
    });
  }
  return ctx.company_id;
}

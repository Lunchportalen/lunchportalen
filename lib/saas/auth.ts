// lib/saas/auth.ts
import "server-only";

import { jsonErr } from "@/lib/http/respond";
import type { AuthedCtx } from "@/lib/http/routeGuard";
import type { CurrentTenant, TenantRole } from "@/lib/saas/tenant";

export type RequiredTenant = {
  userId: string;
  companyId: string;
  role: TenantRole | string;
};

/**
 * Fail-closed: caller must have a company_id on scope (server truth).
 * Returns a JSON Response when tenant is missing (for API routes).
 */
export function requireTenant(ctx: AuthedCtx): RequiredTenant | Response {
  const rid = String(ctx.rid ?? "").trim() || "rid_unknown";
  const userId = String(ctx.scope.userId ?? "").trim();
  const companyId = String(ctx.scope.companyId ?? "").trim();
  const role = ctx.scope.role;

  if (!userId) {
    return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
  }
  if (!companyId) {
    return jsonErr(rid, "Mangler tenant (firmascope).", 403, "MISSING_TENANT", {
      path: ctx.route,
    });
  }
  if (role == null || String(role).trim() === "") {
    return jsonErr(rid, "Mangler rolle.", 403, "MISSING_ROLE", { path: ctx.route });
  }

  return { userId, companyId, role: role as TenantRole | string };
}

export function tenantFromAuthedCtx(ctx: AuthedCtx): CurrentTenant | null {
  const userId = String(ctx.scope.userId ?? "").trim();
  if (!userId) return null;
  return {
    userId,
    companyId: ctx.scope.companyId ?? null,
    role: ctx.scope.role,
    email: ctx.scope.email,
  };
}

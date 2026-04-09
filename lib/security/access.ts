// lib/security/access.ts
import "server-only";

import { jsonErr } from "@/lib/http/respond";
import { requireRoleOr403, type AllowedRole, type AuthedCtx } from "@/lib/http/routeGuard";

/**
 * Explicit role gate (deny by default — only listed roles pass).
 */
export function requireRole(ctx: AuthedCtx, allowed: ReadonlyArray<AllowedRole | string>): Response | null {
  return requireRoleOr403(ctx, allowed as AllowedRole[]);
}

/** Permission keys → roles allowed. Unknown actions: deny. */
const PERMISSIONS: Record<string, ReadonlyArray<AllowedRole | string>> = {
  "security.audit.read": ["company_admin", "superadmin"],
  "saas.billing.manage": ["company_admin"],
};

export function checkPermission(ctx: AuthedCtx, action: string): boolean {
  const allowed = PERMISSIONS[action];
  if (!allowed?.length) return false;
  const role = ctx.scope.role != null ? String(ctx.scope.role).toLowerCase() : "";
  return allowed.map((r) => String(r).toLowerCase()).includes(role);
}

export function requirePermissionOr403(ctx: AuthedCtx, action: string): Response | null {
  const rid = String(ctx.rid ?? "").trim() || "rid_security";
  if (!checkPermission(ctx, action)) {
    return jsonErr(rid, "Ingen tilgang.", 403, "PERMISSION_DENIED", { action });
  }
  return null;
}

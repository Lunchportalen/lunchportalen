import type { AuthContext } from "@/lib/auth/getAuthContext";

import { hasAnyRole } from "@/lib/auth/roles";

/**
 * Tenant law: kitchen/driver are tenant-bound to their assigned company/location
 * (getAuthContext requires both for these roles). No role gets blanket access
 * except superadmin. Fail-closed on missing assignment.
 */
export function canAccessCompany(ctx: AuthContext, companyId: string): boolean {
  if (!ctx.sessionOk) return false;
  if (ctx.role === "superadmin") return true;
  if (!ctx.company_id) return false;
  return ctx.company_id === companyId;
}

export function canAccessLocation(ctx: AuthContext, locationId: string): boolean {
  if (!ctx.sessionOk) return false;
  if (ctx.role === "superadmin") return true;
  if (!ctx.location_id) return false;
  return ctx.location_id === locationId;
}

export function canAccessBackoffice(ctx: AuthContext): boolean {
  return hasAnyRole(ctx, ["superadmin"]);
}

export function canAccessKitchen(ctx: AuthContext): boolean {
  return hasAnyRole(ctx, ["kitchen", "superadmin"]);
}

export function canAccessDriver(ctx: AuthContext): boolean {
  return hasAnyRole(ctx, ["driver", "superadmin"]);
}

export function canAccessApp(ctx: AuthContext): boolean {
  return hasAnyRole(ctx, ["employee", "company_admin", "superadmin"]);
}

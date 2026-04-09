import type { AuthContext } from "@/lib/auth/getAuthContext";

import { hasAnyRole } from "@/lib/auth/roles";

export function canAccessCompany(ctx: AuthContext, companyId: string): boolean {
  if (!ctx.sessionOk) return false;
  if (ctx.role === "superadmin") return true;
  if (ctx.role === "kitchen") return true;
  if (ctx.role === "driver") return true;
  return ctx.company_id === companyId;
}

export function canAccessLocation(ctx: AuthContext, locationId: string): boolean {
  if (!ctx.sessionOk) return false;
  if (ctx.role === "superadmin") return true;
  if (ctx.role === "kitchen") return true;
  if (ctx.role === "driver") return true;
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

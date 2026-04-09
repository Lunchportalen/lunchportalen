import type { AuthContext, AuthRole } from "@/lib/auth/getAuthContext";
import { normalizeRole, normalizeRoleDefaultEmployee } from "@/lib/auth/role";
import { systemRoleByEmail } from "@/lib/system/emails";

/**
 * Enterprise-friendly aliases — map to canonical `Role` / `AllowedRole` in this codebase.
 * (Lunchportalen bruker `company_admin` og `employee`, ikke generiske "admin"/"user".)
 */
export const ROLES = {
  SUPERADMIN: "superadmin",
  /** Firma-administrator (tenant scope). */
  ADMIN: "company_admin",
  /** Innlogget sluttbruker (ansatt / portal). */
  USER: "employee",
} as const;

export type { Role } from "./redirect";
export { homeForRole } from "./redirect";
import type { Role } from "./redirect";

function isAuthContext(v: unknown): v is AuthContext {
  return typeof v === "object" && v !== null && "sessionOk" in v && "rid" in v;
}

/** DB / profile string → canonical Role (no default to employee). */
export function roleFromProfile(raw: string | null | undefined): Role | null {
  return normalizeRole(raw);
}

/**
 * Client-side style role resolution: email allowlist → profile → metadata (metadata may default to employee).
 */
export function computeRole(
  user: { email?: string | null; user_metadata?: unknown } | null | undefined,
  profileRole?: string | null
): Role {
  const byEmail = systemRoleByEmail(user?.email ?? null);
  if (byEmail) return byEmail;

  const fromProfile = roleFromProfile(profileRole ?? null);
  if (fromProfile) return fromProfile;

  return normalizeRoleDefaultEmployee((user as { user_metadata?: { role?: unknown } })?.user_metadata?.role);
}

/** RBAC: valid session + exact role (AuthContext). */
export function hasRole(ctx: AuthContext, role: NonNullable<AuthRole>): boolean;
/** Legacy: role ∈ allowed (non-context). */
export function hasRole(role: Role, allowed: readonly Role[]): boolean;
export function hasRole(
  ctxOrRole: AuthContext | Role,
  roleOrAllowed: NonNullable<AuthRole> | readonly Role[]
): boolean {
  if (isAuthContext(ctxOrRole)) {
    if (!ctxOrRole.sessionOk) return false;
    return ctxOrRole.role === roleOrAllowed;
  }
  return (roleOrAllowed as readonly Role[]).includes(ctxOrRole as Role);
}

export function hasAnyRole(ctx: AuthContext, roles: readonly Role[]): boolean {
  if (!ctx.sessionOk || ctx.role == null) return false;
  return roles.includes(ctx.role as Role);
}

export const isSuperadmin = (ctx: AuthContext) => hasRole(ctx, "superadmin");
export const isCompanyAdmin = (ctx: AuthContext) => hasRole(ctx, "company_admin");
export const isEmployee = (ctx: AuthContext) => hasRole(ctx, "employee");
export const isKitchen = (ctx: AuthContext) => hasRole(ctx, "kitchen");
export const isDriver = (ctx: AuthContext) => hasRole(ctx, "driver");

/** Full pipeline OK (session + membership/profile rules in getAuthContext). */
export function requireRole(ctx: AuthContext, role: string): boolean {
  if (!ctx.ok) return false;
  return ctx.role === role;
}

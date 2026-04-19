// STATUS: KEEP

import "server-only";

import { SYSTEM_EMAILS } from "@/lib/system/emails";

export type Role = "superadmin" | "company_admin" | "employee" | "driver" | "kitchen";

/**
 * Kanonisk rolle-normalisering (DB/RPC-aliaser inkludert).
 * Brukes av getAuthContext og post-login.
 */
export function normalizeRole(v: unknown): Role | null {
  const r = String(v ?? "").trim().toLowerCase();
  if (r === "superadmin" || r === "super_admin" || r === "root") return "superadmin";
  if (r === "company_admin" || r === "companyadmin" || r === "admin") return "company_admin";
  if (r === "employee" || r === "ansatt") return "employee";
  if (r === "kitchen" || r === "kjokken") return "kitchen";
  if (r === "driver" || r === "sjafor") return "driver";
  return null;
}

/**
 * Metadata/legacy (scope, user_metadata): ukjent eller tom streng → `employee`.
 * Ikke bruk som eneste gate der `null` skal bety «mangler profil».
 */
export function normalizeRoleDefaultEmployee(v: unknown): Role {
  return normalizeRole(v) ?? "employee";
}

export function landingForRole(role: Role): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "driver") return "/driver";
  if (role === "kitchen") return "/kitchen";
  return "/week";
}

export function sanitizePostLoginNextPath(nextPath: string | null | undefined): string | null {
  if (!nextPath) return null;
  const n = String(nextPath ?? "").trim();
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
  if (n.includes("\n") || n.includes("\r") || n.includes("\t")) return null;
  if (n.startsWith("/api/")) return null;

  if (
    n === "/login" ||
    n.startsWith("/login/") ||
    n === "/register" ||
    n.startsWith("/register/") ||
    n === "/registrering" ||
    n.startsWith("/registrering/") ||
    n === "/forgot-password" ||
    n.startsWith("/forgot-password/") ||
    n === "/reset-password" ||
    n.startsWith("/reset-password/") ||
    n === "/onboarding" ||
    n.startsWith("/onboarding/")
  ) {
    return null;
  }

  return n;
}

export function allowNextForRole(role: Role, nextPath: string | null): string | null {
  if (!nextPath) return null;

  if (role === "superadmin") {
    return nextPath.startsWith("/superadmin") ||
      nextPath.startsWith("/backoffice") ||
      nextPath.startsWith("/umbraco")
      ? nextPath
      : null;
  }
  if (role === "company_admin") return nextPath.startsWith("/admin") ? nextPath : null;
  if (role === "driver") return nextPath.startsWith("/driver") ? nextPath : null;
  if (role === "kitchen") return nextPath.startsWith("/kitchen") ? nextPath : null;

  // employee: kun /week som appflate (bestilling skjer i /week; API /api/order/* uendret)
  if (role === "employee") {
    return nextPath.startsWith("/week") ? nextPath : null;
  }
  return null;
}

export function resolvePostLoginTarget(role: Role | null, nextPath: string | null): string {
  if (!role) return "/week";
  return allowNextForRole(role, nextPath) ?? landingForRole(role);
}

export function resolvePostLoginTargetForAuth(input: {
  role: Role | null;
  email?: string | null;
  nextPath: string | null;
}): string {
  const email = String(input.email ?? "").trim().toLowerCase();
  if (email === SYSTEM_EMAILS.ORDER) return "/outbox";
  return resolvePostLoginTarget(input.role, input.nextPath);
}

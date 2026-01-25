// lib/auth/roles.ts
export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================================================
   Normalization
========================================================= */
export function normEmail(v: any): string {
  return String(v ?? "").trim().toLowerCase();
}

/**
 * HARD e-post-fasit for systemkontoer
 * (Skal være identisk med middleware-prinsippet.)
 */
export function roleByEmail(email: string | null | undefined): Role | null {
  const e = normEmail(email);
  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  if (e === "driver@lunchportalen.no") return "driver";
  return null;
}

export function isSystemEmail(email: string | null | undefined): boolean {
  return roleByEmail(email) !== null;
}

/**
 * Role fra Supabase user_metadata
 * - Default: employee
 * - Tåler casing og ukjente verdier
 */
export function roleFromMetadata(user: any): Role {
  const raw = String(user?.user_metadata?.role ?? "employee").trim().toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
}

/**
 * Role fra profiles.role (DB) – normaliserer casing
 */
export function roleFromProfile(profileRole: any): Role | null {
  const pr = String(profileRole ?? "").trim().toLowerCase();
  if (!pr) return null;

  if (pr === "company_admin") return "company_admin";
  if (pr === "superadmin") return "superadmin";
  if (pr === "kitchen") return "kitchen";
  if (pr === "driver") return "driver";
  if (pr === "employee") return "employee";

  return null;
}

/**
 * Enhetlig rolle-resolusjon:
 * 1) Systemkonto e-post (hard fasit)
 * 2) Profile role (DB) hvis satt
 * 3) Metadata role (auth) fallback
 */
export function computeRole(user: any, profileRole?: any): Role {
  const byEmail = roleByEmail(user?.email);
  if (byEmail) return byEmail;

  const byProfile = roleFromProfile(profileRole);
  if (byProfile) return byProfile;

  return roleFromMetadata(user);
}

/**
 * Default "hjem" per rolle (brukes for redirect-gates)
 */
export function homeForRole(role: Role): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  if (role === "company_admin") return "/admin";
  return "/week";
}

/**
 * Praktisk helper for gating:
 * - Returnerer true hvis rollen er en av allowed
 */
export function hasRole(role: Role, allowed: Role[] | ReadonlyArray<Role>): boolean {
  return allowed.includes(role);
}

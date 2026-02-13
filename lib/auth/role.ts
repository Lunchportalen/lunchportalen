import "server-only";

export type Role = "superadmin" | "company_admin" | "employee" | "driver" | "kitchen";

export function normalizeRole(v: unknown): Role | null {
  const r = String(v ?? "").trim().toLowerCase();
  if (r === "superadmin") return "superadmin";
  if (r === "company_admin") return "company_admin";
  if (r === "driver") return "driver";
  if (r === "kitchen") return "kitchen";
  if (r === "employee") return "employee";
  return null;
}

export function landingForRole(role: Role): string {
  if (role === "superadmin") return "/superadmin";
  if (role === "company_admin") return "/admin";
  if (role === "driver") return "/driver";
  if (role === "kitchen") return "/kitchen";
  return "/week";
}

export function allowNextForRole(role: Role, nextPath: string | null): string | null {
  if (!nextPath) return null;

  if (role === "superadmin") return nextPath.startsWith("/superadmin") ? nextPath : null;
  if (role === "company_admin") return nextPath.startsWith("/admin") ? nextPath : null;
  if (role === "driver") return nextPath.startsWith("/driver") ? nextPath : null;
  if (role === "kitchen") return nextPath.startsWith("/kitchen") ? nextPath : null;

  // employee allowlist
  if (nextPath.startsWith("/week") || nextPath.startsWith("/min-side")) return nextPath;
  return null;
}

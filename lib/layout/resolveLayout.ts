import type { LayoutType } from "./types";

export type ResolveLayoutInput = {
  role?: string | null | undefined;
  pathname: string;
  /**
   * CMS / marketing page preview rendered while the real router path is under `/backoffice`.
   * Forces the public marketing shell so preview matches `app/(public)/layout`.
   */
  treatAsPublicSitePreview?: boolean;
};

/** Spec name for `ResolveLayoutInput`. */
export type Input = ResolveLayoutInput;

function normPath(pathname: string): string {
  const p = String(pathname ?? "").trim();
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

const APP_ROLE_PREFIXES: Array<{ prefix: string; roles: readonly string[]; layout: LayoutType }> = [
  { prefix: "/week", roles: ["employee", "company_admin"], layout: "employee" },
  { prefix: "/dashboard", roles: ["employee", "company_admin"], layout: "employee" },
  { prefix: "/home", roles: ["employee", "company_admin"], layout: "employee" },
];

/**
 * Deterministic layout classification from URL + role.
 * Non-app URLs (marketing, auth, etc.) resolve to `public` even when a session exists.
 */
export function resolveLayout({ role, pathname, treatAsPublicSitePreview }: ResolveLayoutInput): LayoutType {
  const path = normPath(pathname);
  const r = typeof role === "string" ? role.trim() : "";

  if (treatAsPublicSitePreview) return "public";

  if (path.startsWith("/backoffice")) return "backoffice";
  if (path.startsWith("/superadmin")) return "superadmin";
  if (path.startsWith("/admin")) return "company";
  if (path.startsWith("/kitchen")) return "kitchen";
  if (path.startsWith("/driver")) return "driver";

  for (const rule of APP_ROLE_PREFIXES) {
    if (path.startsWith(rule.prefix) && rule.roles.includes(r)) {
      return rule.layout;
    }
  }

  const isAppPath =
    path.startsWith("/backoffice") ||
    path.startsWith("/superadmin") ||
    path.startsWith("/admin") ||
    path.startsWith("/kitchen") ||
    path.startsWith("/driver") ||
    path.startsWith("/week") ||
    path.startsWith("/dashboard") ||
    path.startsWith("/home") ||
    path.startsWith("/orders");

  if (!isAppPath) return "public";

  if (r === "superadmin") return "superadmin";
  if (r === "company_admin") return "company";
  if (r === "employee") return "employee";
  if (r === "kitchen") return "kitchen";
  if (r === "driver") return "driver";

  return "public";
}

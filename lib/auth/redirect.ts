// lib/auth/redirect.ts
export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export type AgreementState =
  | "active"
  | "paused"
  | "closed"
  | "missing_agreement"
  | "pending"
  | "blocked";

export type HomeScopeHint = {
  role: Role;
  /**
   * If provided, we can route more precisely than role-only.
   */
  company_id?: string | null;
  location_id?: string | null;
  agreement_status?: "active" | "paused" | "closed" | "unknown" | null;
  billing_hold?: boolean | null;
  is_active?: boolean | null;
};

function statusUrl(state: AgreementState, next: string) {
  return `/status?state=${encodeURIComponent(state)}&next=${encodeURIComponent(next)}`;
}

/**
 * Role-only home (legacy)
 */
export function homeForRole(role: Role) {
  switch (role) {
    case "superadmin":
      return "/superadmin";
    case "company_admin":
      return "/admin";
    case "kitchen":
      return "/kitchen";
    case "driver":
      return "/driver";
    case "employee":
    default:
      return "/week";
  }
}

/**
 * Enterprise home routing:
 * - If tenant bindings missing => status
 * - If agreement paused/closed/missing => status
 * - billing_hold does NOT change destination; /week renders read-only
 */
export function homeForUser(scope: HomeScopeHint) {
  const role = scope.role;

  // System roles: always go to their surface
  if (role === "superadmin") return "/superadmin";
  if (role === "kitchen") return "/kitchen";
  if (role === "driver") return "/driver";
  if (role === "company_admin") return "/admin";

  // Employee routing (enterprise)
  const next = "/week";

  // Missing bindings
  if (!scope.company_id || !scope.location_id) {
    return statusUrl("pending", next);
  }

  // Account inactive
  if (scope.is_active === false) {
    return statusUrl("pending", next);
  }

  const ag = (scope.agreement_status ?? "unknown") as string;

  // Agreement gates
  if (ag === "paused") return statusUrl("paused", next);
  if (ag === "closed") return statusUrl("closed", next);
  if (ag === "unknown" || !ag) {
    // unknown means we could not verify; fail-closed
    return statusUrl("blocked", next);
  }

  // Missing agreement
  // (some callers may set agreement_status as null and communicate missing via other means)
  // Here we treat non-active + not paused/closed as missing/pending.
  if (ag !== "active") {
    return statusUrl("missing_agreement", next);
  }

  // billing_hold => still /week (read-only)
  return next;
}

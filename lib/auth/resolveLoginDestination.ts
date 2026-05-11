// lib/auth/resolveLoginDestination.ts
import "server-only";

import { normalizeRole, type Role } from "@/lib/auth/role";

export type ResolveLoginDestinationInput = {
  role: Role | string | null | undefined;
  hasActiveAgreement: boolean;
};

/**
 * Canonical post-login destination resolver.
 *
 * Pure function: same inputs → same output. No DB, no side effects.
 * Single source of truth for role → landing-path mapping after login.
 * Callers responsible for supplying `hasActiveAgreement`.
 */
export function resolveLoginDestination(input: ResolveLoginDestinationInput): string {
  const role = normalizeRole(input.role);
  const hasActiveAgreement = Boolean(input.hasActiveAgreement);

  if (!role) return "/login?code=NO_ROLE";

  if (role === "superadmin") return "/superadmin";

  if (role === "driver") return "/driver";

  if (role === "kitchen") return "/kitchen";

  if (role === "company_admin") {
    return hasActiveAgreement ? "/admin" : "/avtale-ikke-aktiv";
  }

  if (role === "employee") {
    return hasActiveAgreement ? "/week" : "/avtale-ikke-aktiv";
  }

  return "/login?code=NO_ROLE";
}

// lib/auth/roleHome.ts
import "server-only";

import { getProviderMemberships } from "@/lib/auth/provider";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { landingForRole, normalizeRole, type Role } from "@/lib/auth/role";
import type { ProviderMembership, ProviderRole } from "@/lib/providers/types";
import { isProviderRole } from "@/lib/providers/types";

const PROVIDER_ROLE_RANK: Record<ProviderRole, number> = {
  provider_viewer: 1,
  provider_kitchen: 2,
  provider_admin: 3,
};

export type RoleHomeInput = {
  profileRole?: string | null;
  providerRole?: ProviderRole | null;
  isPlatformAdmin?: boolean;
  hasActiveAgreement?: boolean;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeProviderProfileRole(v: unknown): ProviderRole | null {
  const r = safeStr(v);
  if (isProviderRole(r)) return r;
  return null;
}

/** Highest provider membership role across all providers (Patch 8 hierarchy). */
export function primaryProviderRoleFromMemberships(
  memberships: ProviderMembership[],
): ProviderRole | null {
  let best: ProviderRole | null = null;
  let bestRank = 0;
  for (const m of memberships) {
    const rank = PROVIDER_ROLE_RANK[m.role] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = m.role;
    }
  }
  return best;
}

function providerRoleHomePath(role: ProviderRole): string {
  if (role === "provider_admin") return "/leverandor";
  if (role === "provider_kitchen") return "/leverandor/ordrer";
  return "/leverandor";
}

/**
 * Canonical role → landing path (post-login + layout redirects).
 * Provider membership wins over company profile role when both exist.
 */
export function roleHomePath(input: RoleHomeInput): string {
  const hasActiveAgreement = input.hasActiveAgreement !== false;
  const profileRole = normalizeRole(input.profileRole);
  const profileProviderRole = normalizeProviderProfileRole(input.profileRole);
  const providerRole = input.providerRole ?? profileProviderRole;

  if (input.isPlatformAdmin || profileRole === "superadmin") {
    return "/superadmin";
  }

  if (providerRole) {
    return providerRoleHomePath(providerRole);
  }

  if (profileRole === "company_admin") {
    return hasActiveAgreement ? "/admin" : "/avtale-ikke-aktiv";
  }

  if (profileRole === "company_finance" || profileRole === "location_admin") {
    return hasActiveAgreement ? landingForRole(profileRole) : "/avtale-ikke-aktiv";
  }

  if (profileRole === "driver") return "/driver";
  if (profileRole === "kitchen") return "/kitchen";

  if (profileRole === "employee") {
    return hasActiveAgreement ? "/week" : "/avtale-ikke-aktiv";
  }

  if (!profileRole) return "/login?code=NO_ROLE";

  return "/week";
}

/**
 * Profile-role-only home (layouts without membership lookup).
 * Prefer `resolveRoleHomeForUser` for post-login when provider memberships exist.
 */
export function roleHome(role: string): string {
  return roleHomePath({ profileRole: role, hasActiveAgreement: true });
}

/**
 * Post-login resolver: memberships + platform admin + profile role.
 */
export async function resolveRoleHomeForUser(input: {
  userId: string;
  profileRole: Role | string | null | undefined;
  hasActiveAgreement: boolean;
}): Promise<string> {
  const uid = String(input.userId ?? "").trim();
  const profileRole = normalizeRole(input.profileRole);
  const isPlatformAdmin =
    profileRole === "superadmin" || (uid ? await isSuperadminProfile(uid) : false);

  const memberships = uid ? await getProviderMemberships(uid) : [];
  const providerRole = primaryProviderRoleFromMemberships(memberships);

  return roleHomePath({
    profileRole: input.profileRole,
    providerRole,
    isPlatformAdmin,
    hasActiveAgreement: input.hasActiveAgreement,
  });
}

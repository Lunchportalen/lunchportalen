// lib/auth/provider.ts
/**
 * Provider membership auth helpers (PROVIDER-PLAN-V1 §5).
 * TS mirror of SQL `can_access_provider()` + role hierarchy for Patch 9/10.
 *
 * @example
 * const ok = await canAccessProvider(userId, providerId);
 * if (!ok) return jsonErr(rid, "Ingen tilgang.", 403, "FORBIDDEN");
 */
import "server-only";

import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import type { ProviderMembership, ProviderRole } from "@/lib/providers/types";
import { isProviderRole } from "@/lib/providers/types";
import { supabaseServer } from "@/lib/supabase/server";

type ProviderMembershipRow = {
  id: string;
  user_id: string;
  provider_id: string;
  role: string;
  created_at: string;
};

const PROVIDER_ROLE_RANK: Record<ProviderRole, number> = {
  provider_viewer: 1,
  provider_kitchen: 2,
  provider_admin: 3,
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function mapMembershipRow(row: ProviderMembershipRow): ProviderMembership {
  return {
    id: row.id,
    userId: row.user_id,
    providerId: row.provider_id,
    role: row.role as ProviderRole,
    createdAt: row.created_at,
  };
}

/**
 * Rank comparison: higher rank satisfies lower required roles.
 * provider_admin (3) > provider_kitchen (2) > provider_viewer (1).
 */
export function providerRoleSatisfies(actual: ProviderRole | null, required: ProviderRole): boolean {
  if (!actual || !isProviderRole(required)) return false;
  return PROVIDER_ROLE_RANK[actual] >= PROVIDER_ROLE_RANK[required];
}

/**
 * All provider memberships for a user.
 *
 * @example
 * const memberships = await getProviderMemberships(session.user.id);
 */
export async function getProviderMemberships(userId: string): Promise<ProviderMembership[]> {
  const uid = safeStr(userId);
  if (!uid) return [];

  try {
    const sb = await supabaseServer();
    const { data, error } = await (sb as any)
      .from("provider_memberships")
      .select("id, user_id, provider_id, role, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });

    if (error || !Array.isArray(data)) return [];
    return (data as ProviderMembershipRow[]).map(mapMembershipRow);
  } catch {
    return [];
  }
}

/**
 * Membership role for one provider, or `null` when none.
 *
 * @example
 * const role = await getProviderRole(userId, melhusId);
 */
export async function getProviderRole(userId: string, providerId: string): Promise<ProviderRole | null> {
  const pid = safeStr(providerId);
  if (!pid) return null;

  const memberships = await getProviderMemberships(userId);
  const hit = memberships.find((m) => m.providerId === pid);
  return hit?.role ?? null;
}

/**
 * True when the user has at least `requiredRole` on the provider (hierarchy-aware).
 *
 * @example
 * await hasProviderRole(uid, pid, "provider_kitchen"); // admin → true, viewer → false
 */
export async function hasProviderRole(
  userId: string,
  providerId: string,
  requiredRole: ProviderRole,
): Promise<boolean> {
  const actual = await getProviderRole(userId, providerId);
  return providerRoleSatisfies(actual, requiredRole);
}

/**
 * TS mirror of `public.can_access_provider(uuid)`:
 * provider membership OR platform superadmin.
 *
 * @example
 * if (!(await canAccessProvider(userId, providerId))) throw new ProviderForbiddenError();
 */
export async function canAccessProvider(userId: string, providerId: string): Promise<boolean> {
  const uid = safeStr(userId);
  const pid = safeStr(providerId);
  if (!uid || !pid) return false;

  if (await isSuperadminProfile(uid)) return true;

  const memberships = await getProviderMemberships(uid);
  return memberships.some((m) => m.providerId === pid);
}

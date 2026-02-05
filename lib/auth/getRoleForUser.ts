// lib/auth/getRoleForUser.ts
import { supabaseServer } from "@/lib/supabase/server";
import type { Role } from "@/lib/auth/roles";
import { roleFromProfile } from "@/lib/auth/roles";

type ProfileRow = {
  role: string | null;
};

/**
 * Canonical role lookup (DB-only).
 * - Returns null if missing or unknown.
 */
export async function getRoleForUser(userId: string): Promise<Role | null> {
  if (!userId) return null;

  try {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("profiles")
      .select("role")
      .or(`id.eq.${userId},user_id.eq.${userId}`)
      .maybeSingle<ProfileRow>();

    if (error || !data) return null;

    return roleFromProfile(data.role);
  } catch {
    return null;
  }
}

// lib/auth/isSuperadminProfile.ts
import "server-only";

import { getRoleForUser } from "@/lib/auth/getRoleForUser";

/**
 * Single source of truth for superadmin: profiles.role === "superadmin"
 * (via getRoleForUser → roleFromProfile).
 */
export async function isSuperadminProfile(userId: string): Promise<boolean> {
  if (!userId) return false;
  const role = await getRoleForUser(userId);
  return role === "superadmin";
}

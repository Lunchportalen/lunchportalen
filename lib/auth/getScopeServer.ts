// lib/auth/getScopeServer.ts
import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { ScopeError } from "@/lib/auth/scope";
import { computeRole, type Role } from "@/lib/auth/roles";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function getScopeServer() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    throw new ScopeError("UNAUTHENTICATED", 401);
  }

  // profileRole (DB) is authoritative when present
  let profileRole: any = null;
  try {
    profileRole = await getRoleForUser(user.id);
  } catch {
    profileRole = null;
  }

  const role: Role = computeRole(user, profileRole);

  const companyId =
    safeStr(user.user_metadata?.company_id) ||
    safeStr(user.app_metadata?.company_id) ||
    null;

  const locationId =
    safeStr((user.user_metadata as any)?.location_id) ||
    safeStr((user.app_metadata as any)?.location_id) ||
    null;

  return {
    user,
    role,
    company_id: companyId,
    location_id: locationId,
    email: user.email ?? null,
  };
}

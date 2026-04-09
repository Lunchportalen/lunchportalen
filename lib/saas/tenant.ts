// lib/saas/tenant.ts
import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

export type SaasPlan = "none" | "basic" | "pro" | "enterprise";

export type TenantRole = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export type CurrentTenant = {
  userId: string;
  companyId: string | null;
  role: TenantRole | string | null;
  email: string | null;
};

/**
 * Server-side tenant context from session + profiles row (canonical: profiles.id = auth user id).
 */
export async function getCurrentTenant(): Promise<CurrentTenant | null> {
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user?.id) return null;

  const uid = auth.user.id;
  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("role, company_id, email")
    .eq("id", uid)
    .maybeSingle();

  if (profErr) return null;

  return {
    userId: uid,
    companyId: (profile?.company_id as string | null) ?? null,
    role: (profile?.role as TenantRole | string | null) ?? null,
    email: (profile?.email as string | null) ?? auth.user.email ?? null,
  };
}

export function isSaasPlan(v: unknown): v is SaasPlan {
  return v === "none" || v === "basic" || v === "pro" || v === "enterprise";
}

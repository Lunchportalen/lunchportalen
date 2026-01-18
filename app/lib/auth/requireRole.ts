// lib/auth/requireRole.ts
import { supabaseServer } from "@/lib/supabase/server";

export async function requireRole(allowed: Array<"superadmin" | "company_admin" | "employee">) {
  const supabase = await supabaseServer();
  const { data: authData, error: authErr } = await supabase.auth.getUser();

  if (authErr || !authData?.user) {
    return { ok: false as const, status: 401, error: "Not authenticated" };
  }

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", authData.user.id)
    .single();

  if (profErr || !prof) {
    return { ok: false as const, status: 403, error: "Profile missing" };
  }

  if (!allowed.includes(prof.role)) {
    return { ok: false as const, status: 403, error: "Forbidden" };
  }

  return { ok: true as const, userId: authData.user.id, role: prof.role, companyId: prof.company_id, supabase };
}

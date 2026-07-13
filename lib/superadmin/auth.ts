// STATUS: KEEP

// lib/superadmin/auth.ts
import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/**
 * Superadmin API gate. Role truth is server-side `profiles.role`
 * (D4: user_metadata is never an authorization source).
 */
export async function requireSuperadmin() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Ikke innlogget");

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("role, disabled_at")
    .eq("id", data.user.id)
    .maybeSingle<{ role: string | null; disabled_at: string | null }>();

  if (profErr || !prof) throw new Error("Ingen tilgang");
  if (prof.disabled_at) throw new Error("Ingen tilgang");
  if (String(prof.role ?? "").toLowerCase() !== "superadmin") throw new Error("Ingen tilgang");

  return { supabase, user: data.user };
}

/**
 * Non-throwing variant for API routes (401/403 result object).
 * Same truth source: profiles.role only.
 */
export async function requireSuperadminApi(): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403; message: string }
> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false, status: 401, message: "Ikke innlogget" };

  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("role, disabled_at")
    .eq("id", data.user.id)
    .maybeSingle<{ role: string | null; disabled_at: string | null }>();

  if (profErr || !prof) return { ok: false, status: 403, message: "Ingen tilgang" };
  if (prof.disabled_at) return { ok: false, status: 403, message: "Ingen tilgang" };
  if (String(prof.role ?? "").toLowerCase() !== "superadmin") {
    return { ok: false, status: 403, message: "Ingen tilgang" };
  }

  return { ok: true, userId: data.user.id };
}

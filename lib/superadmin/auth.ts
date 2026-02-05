// lib/superadmin/auth.ts
import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

export type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

export async function requireSuperadmin() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Ikke innlogget");

  const role = String(data.user.user_metadata?.role ?? "");
  if (role !== "superadmin") throw new Error("Ingen tilgang");

  return { supabase, user: data.user };
}

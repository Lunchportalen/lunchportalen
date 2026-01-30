// app/superadmin/companies/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import CompaniesClient from "./companies-client";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type ProfileRow = { role: Role | null; disabled_at?: string | null };

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}
function isHardSuperadmin(email: string | null | undefined) {
  return normEmail(email) === "superadmin@lunchportalen.no";
}

export default async function SuperadminCompaniesPage() {
  const sb = await supabaseServer();

  // =========================
  // 1) Auth gate (fail-closed)
  // =========================
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect("/login?next=/superadmin/companies");
  }

  // =========================
  // 2) Hard gate (email først)
  // =========================
  if (!isHardSuperadmin(user.email)) {
    redirect("/login?next=/superadmin/companies");
  }

  // =========================
  // 3) Role gate via profiles
  // =========================
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("role,disabled_at")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  // Fail-closed: hvis profil ikke kan leses -> login
  if (pErr || !profile?.role) {
    redirect("/login?next=/superadmin/companies");
  }

  // Disabled gate (også superadmin)
  if (profile.disabled_at) {
    redirect("/login?next=/superadmin/companies");
  }

  // Role mismatch
  if (profile.role !== "superadmin") {
    redirect("/login?next=/superadmin/companies");
  }

  // Client henter data selv (kontrollert via superadmin API)
  return <CompaniesClient />;
}

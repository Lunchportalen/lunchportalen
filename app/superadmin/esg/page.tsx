// app/superadmin/esg/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import SuperadminEsgBenchmarkClient from "./SuperadminEsgBenchmarkClient";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type ProfileRow = { role: Role | null };

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}
function isHardSuperadmin(email: string | null | undefined) {
  return normEmail(email) === "superadmin@lunchportalen.no";
}

export default async function SuperadminEsgPage() {
  const sb = await supabaseServer();

  // Auth gate
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect("/login?next=/superadmin/esg");
  }

  // Role gate (FASET: profiles.id = auth.user.id)
  const { data: profile, error: pErr } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (pErr || !profile?.role) redirect("/login?next=/superadmin");
  if (profile.role !== "superadmin" || !isHardSuperadmin(user.email)) {
    redirect("/login?next=/superadmin");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 lp-select-text">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">ESG Benchmark</h1>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
          Oversikt per firma basert på års-snapshots. Kun tall og rangering.
        </p>
      </div>

      <SuperadminEsgBenchmarkClient />
    </main>
  );
}

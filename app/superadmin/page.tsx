// app/superadmin/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import SuperadminClient from "./superadmin-client";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "active" | "paused" | "closed";

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
};

type Stats = {
  companiesTotal: number;
  companiesActive: number;
  companiesPaused: number;
  companiesClosed: number;
};

type ProfileRow = { role: Role };

function isCompanyStatus(x: any): x is CompanyStatus {
  return x === "active" || x === "paused" || x === "closed";
}

export default async function SuperadminPage() {
  const supabase = await supabaseServer();

  // ✅ Auth
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user;
  if (!user) redirect("/login?next=/superadmin");

  // ✅ Role gate
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (pErr || !profile) redirect("/login?next=/superadmin");
  if (profile.role !== "superadmin") redirect("/week");

  // ✅ Companies
  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (cErr) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-lg font-semibold">Superadmin</div>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Klarte ikke å hente firmalisten.
          </p>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-red-700">
            {cErr.message}
          </pre>
        </div>
      </div>
    );
  }

  // ✅ Map hard-typed (unngår any)
  const list: CompanyRow[] = (companies ?? [])
    .map((c: any) => ({
      id: String(c.id),
      name: String(c.name ?? ""),
      orgnr: c.orgnr ? String(c.orgnr) : null,
      status: isCompanyStatus(c.status) ? c.status : "active",
      created_at: String(c.created_at ?? ""),
      updated_at: String(c.updated_at ?? ""),
    }))
    .filter((c) => c.id && c.name);

  const stats: Stats = {
    companiesTotal: list.length,
    companiesActive: list.filter((c) => c.status === "active").length,
    companiesPaused: list.filter((c) => c.status === "paused").length,
    companiesClosed: list.filter((c) => c.status === "closed").length,
  };

  return <SuperadminClient initialCompanies={list} initialStats={stats} />;
}

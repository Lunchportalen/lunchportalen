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

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function safeName(v: any) {
  const s = safeStr(v);
  return s.length ? s : "Ukjent firma";
}

export default async function SuperadminPage() {
  const supabase = await supabaseServer();

  // =========================================================
  // 1) Auth
  // =========================================================
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user;

  if (userErr || !user) {
    redirect("/login?next=/superadmin");
  }

  // =========================================================
  // 2) Role gate (FASIT: profiles.user_id)
  // =========================================================
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single<ProfileRow>();

  if (pErr || !profile) {
    // Ikke tilgang eller profil mangler -> tilbake til login
    redirect("/login?next=/superadmin");
  }

  if (profile.role !== "superadmin") {
    redirect("/week");
  }

  // =========================================================
  // 3) Companies (lett, men komplett grunnlag for UI)
  // =========================================================
  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    // Enterprise: sist endret først er mer operasjonelt enn created_at
    .order("updated_at", { ascending: false });

  if (cErr) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-lg font-semibold">Superadmin</div>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Klarte ikke å hente firmalisten.
          </p>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-red-700">{cErr.message}</pre>
        </div>
      </div>
    );
  }

  // =========================================================
  // 4) Map hard-typed (unngår any)
  // =========================================================
  const list: CompanyRow[] = (companies ?? [])
    .map((c: any) => {
      const id = safeStr(c.id);
      const name = safeName(c.name);
      const orgnr = c.orgnr ? safeStr(c.orgnr) : null;
      const status: CompanyStatus = isCompanyStatus(c.status) ? c.status : "active";

      return {
        id,
        name,
        orgnr,
        status,
        created_at: safeStr(c.created_at),
        updated_at: safeStr(c.updated_at),
      };
    })
    .filter((c) => c.id.length > 0);

  // =========================================================
  // 5) Stats
  // =========================================================
  const stats: Stats = {
    companiesTotal: list.length,
    companiesActive: list.filter((c) => c.status === "active").length,
    companiesPaused: list.filter((c) => c.status === "paused").length,
    companiesClosed: list.filter((c) => c.status === "closed").length,
  };

  // =========================================================
  // 6) Render client UI
  // =========================================================
  return <SuperadminClient initialCompanies={list} initialStats={stats} />;
}

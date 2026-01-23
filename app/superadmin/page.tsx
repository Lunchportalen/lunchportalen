// app/superadmin/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import SuperadminClient from "./superadmin-client";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "pending" | "active" | "paused" | "closed";

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus; // UI bruker lowercase
  created_at: string;
  updated_at: string;
};

type Stats = {
  companiesTotal: number;
  companiesPending: number;
  companiesActive: number;
  companiesPaused: number;
  companiesClosed: number;
};

type ProfileRow = { role: Role };

function isCompanyStatus(x: any): x is CompanyStatus {
  const s = String(x ?? "").trim().toLowerCase();
  return s === "pending" || s === "active" || s === "paused" || s === "closed";
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function safeName(v: any) {
  const s = safeStr(v);
  return s.length ? s : "Ukjent firma";
}

function toCompanyStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim().toLowerCase();
  return isCompanyStatus(s) ? (s as CompanyStatus) : "pending";
}

export default async function SuperadminPage() {
  const supabase = await supabaseServer();

  // =========================================================
  // 1) Auth
  // =========================================================
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) {
    redirect("/login?next=/superadmin");
  }

  // =========================================================
  // 2) Role gate
  // ✅ FASIT: hard superadmin-epost (samme som API-rutene)
  // =========================================================
  const email = safeStr(user.email).toLowerCase();
  if (email !== "superadmin@lunchportalen.no") {
    redirect("/week");
  }

  // (valgfritt ekstra-lag) DB role-check hvis dere har profiles.role
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  // Hvis profiles mangler/feiler: fail-closed til /login (så du ser det tydelig)
  if (pErr) {
    redirect("/login?next=/superadmin");
  }

  // Hvis profiles finnes og role ikke er superadmin → stopp
  if (profile?.role && profile.role !== "superadmin") {
    redirect("/week");
  }

  // =========================================================
  // 3) Companies (kun initial seed for UI; klienten refresher via API)
  // =========================================================
  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (cErr) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-lg font-semibold">Superadmin</div>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Klarte ikke å hente firmalisten.</p>
          <pre className="mt-3 whitespace-pre-wrap text-xs text-red-700">{cErr.message}</pre>
        </div>
      </div>
    );
  }

  // =========================================================
  // 4) Map hard-typed
  // 🔒 Viktig: ukjent/mangler -> pending (aldri active fallback)
  // =========================================================
  const list: CompanyRow[] = (companies ?? [])
    .map((c: any) => {
      const id = safeStr(c.id);
      const name = safeName(c.name);
      const orgnr = c.orgnr ? safeStr(c.orgnr) : null;

      return {
        id,
        name,
        orgnr,
        status: toCompanyStatus(c.status),
        created_at: safeStr(c.created_at),
        updated_at: safeStr(c.updated_at),
      };
    })
    .filter((c) => c.id.length > 0);

  // =========================================================
  // 5) Stats (inkludér pending)
  // =========================================================
  const stats: Stats = {
    companiesTotal: list.length,
    companiesPending: list.filter((c) => c.status === "pending").length,
    companiesActive: list.filter((c) => c.status === "active").length,
    companiesPaused: list.filter((c) => c.status === "paused").length,
    companiesClosed: list.filter((c) => c.status === "closed").length,
  };

  // =========================================================
  // 6) Render client UI
  // =========================================================
  return <SuperadminClient initialCompanies={list} initialStats={stats} />;
}

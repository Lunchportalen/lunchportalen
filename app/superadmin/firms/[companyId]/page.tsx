// app/superadmin/firms/page.tsx
import SuperadminClient from "@/superadmin/superadmin-client";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED";

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

function calcStats(list: CompanyRow[]): Stats {
  return {
    companiesTotal: list.length,
    companiesActive: list.filter((c) => c.status === "ACTIVE").length,
    companiesPaused: list.filter((c) => c.status === "PAUSED").length,
    companiesClosed: list.filter((c) => c.status === "CLOSED").length,
  };
}

function normalizeStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim().toUpperCase();

  if (s === "ACTIVE" || s === "PAUSED" || s === "CLOSED") return s as CompanyStatus;
  if (s === "active") return "ACTIVE";
  if (s === "paused") return "PAUSED";
  if (s === "closed") return "CLOSED";

  // safe default
  return "PAUSED";
}

export default async function FirmsPage() {
  const supabase = await supabaseServer();

  const { data, error } = await supabase
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const initialCompanies: CompanyRow[] = (data ?? []).map((r: any) => ({
    id: String(r.id),
    name: String(r.name ?? ""),
    orgnr: r.orgnr ? String(r.orgnr) : null,
    status: normalizeStatus(r.status),
    created_at: String(r.created_at ?? new Date().toISOString()),
    updated_at: String(r.updated_at ?? r.created_at ?? new Date().toISOString()),
  }));

  const initialStats: Stats = calcStats(initialCompanies);

  return <SuperadminClient initialCompanies={initialCompanies} initialStats={initialStats} />;
}

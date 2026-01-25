// app/superadmin/page.tsx
export const runtime = "nodejs";
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
  status: CompanyStatus; // UI: lowercase
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

type ProfileRow = { role: Role | null; disabled_at?: string | null };

type LastEvent = { label: string; ts: string } | null;
type SystemState = "NORMAL" | "DEGRADED";

/* =========================
   Helpers (enterprise-safe)
========================= */

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function normEmail(v: any) {
  return safeStr(v).toLowerCase();
}

function safeName(v: any) {
  const s = safeStr(v);
  return s.length ? s : "Ukjent firma";
}

function isCompanyStatus(x: any): x is CompanyStatus {
  const s = safeStr(x).toLowerCase();
  return s === "pending" || s === "active" || s === "paused" || s === "closed";
}

function toCompanyStatus(v: any): CompanyStatus {
  const s = safeStr(v).toLowerCase();
  return isCompanyStatus(s) ? (s as CompanyStatus) : "pending"; // 🔒 aldri "active" som fallback
}

function computeStats(list: CompanyRow[]): Stats {
  return {
    companiesTotal: list.length,
    companiesPending: list.filter((c) => c.status === "pending").length,
    companiesActive: list.filter((c) => c.status === "active").length,
    companiesPaused: list.filter((c) => c.status === "paused").length,
    companiesClosed: list.filter((c) => c.status === "closed").length,
  };
}

function computeSystemState(stats: Stats): SystemState {
  return stats.companiesPaused + stats.companiesClosed > 0 ? "DEGRADED" : "NORMAL";
}

function buildLastEvent(list: CompanyRow[]): LastEvent {
  const ts = list[0]?.updated_at ? safeStr(list[0].updated_at) : "";
  return ts ? { label: "Last company change", ts } : null;
}

/** Minimal, enterprise-grade error surface (no leaks) */
function ErrorSurface(props: { title?: string; message: string; detail?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))] shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="text-xs font-extrabold tracking-wide text-neutral-600">SUPERADMIN MODE</div>
          <div className="text-xs font-extrabold text-rose-700">SYSTEM: DEGRADED</div>
        </div>

        <div className="mt-2 text-2xl font-black tracking-tight text-neutral-950">{props.title ?? "Superadmin"}</div>
        <p className="mt-2 text-sm font-semibold text-[rgb(var(--lp-muted))]">{props.message}</p>

        {props.detail ? (
          <pre className="mt-4 overflow-auto rounded-2xl bg-white p-3 text-xs font-semibold text-rose-700 ring-1 ring-neutral-200">
            {props.detail}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

/* =========================
   Page
========================= */

export default async function SuperadminPage() {
  const supabase = await supabaseServer();

  /* =========================================================
     1) Auth (fail-closed)
  ========================================================= */
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) {
    redirect("/login?next=/superadmin");
  }

  /* =========================================================
     2) Gate (hard superadmin email + disabled check)
     ✅ Superadmin skal ALDRI påvirkes av metadata.
  ========================================================= */
  const email = normEmail(user.email);
  if (email !== "superadmin@lunchportalen.no") {
    redirect("/week");
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role,disabled_at")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  // Fail-closed hvis profiles ikke kan leses (security > convenience)
  if (pErr) {
    redirect("/login?next=/superadmin");
  }

  // Disabled gate
  if (profile?.disabled_at) {
    redirect("/login?next=/superadmin");
  }

  // Hvis role finnes og ikke superadmin -> stopp (ekstra-lag)
  if (profile?.role && profile.role !== "superadmin") {
    redirect("/week");
  }

  /* =========================================================
     3) Companies (initial seed)
  ========================================================= */
  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (cErr) {
    return (
      <ErrorSurface
        message="Klarte ikke å hente firmalisten."
        detail={safeStr(cErr.message)}
      />
    );
  }

  /* =========================================================
     4) Normalize + hard typing
  ========================================================= */
  const list: CompanyRow[] = (companies ?? [])
    .map((c: any) => {
      const id = safeStr(c.id);
      if (!id) return null;

      const name = safeName(c.name);
      const orgnr = c.orgnr ? safeStr(c.orgnr) : null;

      return {
        id,
        name,
        orgnr,
        status: toCompanyStatus(c.status),
        created_at: safeStr(c.created_at),
        updated_at: safeStr(c.updated_at),
      } satisfies CompanyRow;
    })
    .filter(Boolean) as CompanyRow[];

  /* =========================================================
     5) Stats + signals
  ========================================================= */
  const stats = computeStats(list);
  const systemState = computeSystemState(stats);
  const lastEvent = buildLastEvent(list);

  /* =========================================================
     6) Render client UI
  ========================================================= */
  return (
    <SuperadminClient
      initialCompanies={list}
      initialStats={stats}
      systemState={systemState}
      lastEvent={lastEvent}
    />
  );
}

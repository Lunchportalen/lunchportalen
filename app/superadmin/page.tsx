// app/superadmin/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

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

function isHardSuperadmin(email: string | null | undefined) {
  return normEmail(email) === "superadmin@lunchportalen.no";
}

/** Minimal, enterprise-grade error surface (no leaks) */
function ErrorSurface(props: { title?: string; message: string; detail?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lp-select-text">
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

async function getOriginFromHeaders(): Promise<string> {
  const h = await headers(); // ✅ din Next krever await her
  const proto = safeStr(h.get("x-forwarded-proto")) || "http";
  const host = safeStr(h.get("x-forwarded-host")) || safeStr(h.get("host"));
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

async function readJsonSafe<T = any>(res: Response): Promise<T | null> {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

type DashboardApiOk = {
  ok: true;
  rid: string;
  data: {
    companies: { active: number; pending: number; paused: number; closed: number; total: number };
    orders: { today: number; tomorrow: number; week: number };
    alerts: { pendingCompanies: number; pausedCompanies: number };
  };
};
type DashboardApiErr = { ok: false; rid?: string; error: string; message?: string; detail?: any };

async function fetchDashboardStats(): Promise<{ stats: Stats | null; degradedByFeed: boolean }> {
  try {
    const origin = await getOriginFromHeaders();
    const cookieHeader = cookies().toString();

    const res = await fetch(`${origin}/api/superadmin/dashboard`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store",
        cookie: cookieHeader,
      },
    });

    const json = await readJsonSafe<DashboardApiOk | DashboardApiErr>(res);

    if (!res.ok || !json || (json as any).ok !== true) {
      return { stats: null, degradedByFeed: true };
    }

    const ok = json as DashboardApiOk;
    const c = ok.data.companies;

    const stats: Stats = {
      companiesTotal: Number(c.total ?? 0) || 0,
      companiesPending: Number(c.pending ?? 0) || 0,
      companiesActive: Number(c.active ?? 0) || 0,
      companiesPaused: Number(c.paused ?? 0) || 0,
      companiesClosed: Number(c.closed ?? 0) || 0,
    };

    return { stats, degradedByFeed: false };
  } catch {
    return { stats: null, degradedByFeed: true };
  }
}

/* =========================
   Page
========================= */

export default async function SuperadminPage() {
  const supabase = await supabaseServer();

  // 1) Auth
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) {
    redirect("/login?next=/superadmin");
  }

  // 2) Hard gate (email først)
  if (!isHardSuperadmin(user.email)) {
    redirect("/login?next=/superadmin");
  }

  // 3) Profile read
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role,disabled_at")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (pErr) {
    return <ErrorSurface message="Kunne ikke verifisere superadmin-profil." detail={safeStr(pErr.message)} />;
  }

  if (profile?.disabled_at) {
    redirect("/login?next=/superadmin");
  }

  if (profile?.role && profile.role !== "superadmin") {
    redirect("/login?next=/superadmin");
  }

  // 4) Companies (seed)
  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (cErr) {
    return <ErrorSurface message="Klarte ikke å hente firmalisten." detail={safeStr(cErr.message)} />;
  }

  // 5) Normalize
  const list: CompanyRow[] = (companies ?? [])
    .map((c: any) => {
      const id = safeStr(c.id);
      if (!id) return null;

      return {
        id,
        name: safeName(c.name),
        orgnr: c.orgnr ? safeStr(c.orgnr) : null,
        status: toCompanyStatus(c.status),
        created_at: safeStr(c.created_at),
        updated_at: safeStr(c.updated_at),
      } satisfies CompanyRow;
    })
    .filter(Boolean) as CompanyRow[];

  // 6) Stats + signals
  const localStats = computeStats(list);

  const { stats: apiStats, degradedByFeed } = await fetchDashboardStats();
  const stats = apiStats ?? localStats;

  const systemState: SystemState = degradedByFeed ? "DEGRADED" : computeSystemState(stats);
  const lastEvent = buildLastEvent(list);

  // 7) Render
  return (
    <SuperadminClient
      initialCompanies={list}
      initialStats={stats}
      systemState={systemState}
      lastEvent={lastEvent}
    />
  );
}

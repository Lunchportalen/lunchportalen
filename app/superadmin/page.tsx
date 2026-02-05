// app/superadmin/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import SuperadminClient from "./superadmin-client";
import { normalizeSuperadminStats, nullSuperadminStats, type SuperadminStats } from "./types";
import { supabaseServer } from "@/lib/supabase/server";
import PageSection from "@/components/layout/PageSection";
import { isSuperadminEmail } from "@/lib/system/emails";

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

type ProfileRow = { role: Role | null; disabled_at?: string | null };

type SystemState = "NORMAL" | "DEGRADED";

/* =========================
   Helpers (enterprise-safe)
========================= */

function safeStr(v: any) {
  return String(v ?? "").trim();
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

function buildStatsFromList(list: CompanyRow[]): SuperadminStats {
  return normalizeSuperadminStats({
    companiesTotal: list.length,
    companiesPending: list.filter((c) => c.status === "pending").length,
    companiesActive: list.filter((c) => c.status === "active").length,
    companiesPaused: list.filter((c) => c.status === "paused").length,
    companiesClosed: list.filter((c) => c.status === "closed").length,
    updatedAt: list[0]?.updated_at ?? null,
  });
}

function mergeStats(primary: SuperadminStats, fallback: SuperadminStats): SuperadminStats {
  return normalizeSuperadminStats({
    companiesTotal: primary.companiesTotal ?? fallback.companiesTotal,
    companiesPending: primary.companiesPending ?? fallback.companiesPending,
    companiesActive: primary.companiesActive ?? fallback.companiesActive,
    companiesPaused: primary.companiesPaused ?? fallback.companiesPaused,
    companiesClosed: primary.companiesClosed ?? fallback.companiesClosed,
    updatedAt: primary.updatedAt ?? fallback.updatedAt,
  });
}

function computeSystemState(stats: SuperadminStats): SystemState {
  const paused = stats.companiesPaused ?? 0;
  const closed = stats.companiesClosed ?? 0;
  return paused + closed > 0 ? "DEGRADED" : "NORMAL";
}

function isHardSuperadmin(email: string | null | undefined) {
  return isSuperadminEmail(email);
}

/** Minimal, enterprise-grade error surface (no leaks) */
function ErrorSurface(props: { title?: string; message: string; detail?: string }) {
  return (
    <PageSection title={props.title ?? "Superadmin"} subtitle={props.message}>
      <div className="lp-select-text space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-extrabold tracking-wide text-neutral-600">SUPERADMIN MODE</div>
          <div className="text-xs font-extrabold text-rose-700">SYSTEM: DEGRADED</div>
        </div>

        {props.detail ? (
          <pre className="overflow-auto rounded-2xl bg-white p-3 text-xs font-semibold text-rose-700 ring-1 ring-neutral-200">
            {props.detail}
          </pre>
        ) : null}
      </div>
    </PageSection>
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

function serializeCookies(cookieStore: Awaited<ReturnType<typeof cookies>>): string {
  const all = cookieStore.getAll();
  if (!all.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function fetchDashboardStats(
  cookieHeader: string
): Promise<{ stats: SuperadminStats; degradedByFeed: boolean; degradedRid: string | null }> {
  const nullStats = nullSuperadminStats();
  try {
    const origin = await getOriginFromHeaders();

    const res = await fetch(`${origin}/api/superadmin/dashboard`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Cache-Control": "no-store",
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });

    const json = await readJsonSafe<DashboardApiOk | DashboardApiErr>(res);

    if (!res.ok || !json || (json as any).ok !== true) {
      const err = json as DashboardApiErr | null;
      return { stats: nullStats, degradedByFeed: true, degradedRid: err?.rid ? safeStr(err.rid) : null };
    }

    const ok = json as DashboardApiOk;
    const c = ok.data.companies;

    const stats = normalizeSuperadminStats({
      companiesTotal: c.total,
      companiesPending: c.pending,
      companiesActive: c.active,
      companiesPaused: c.paused,
      companiesClosed: c.closed,
      updatedAt: new Date().toISOString(),
    });

    return { stats, degradedByFeed: false, degradedRid: null };
  } catch {
    return { stats: nullStats, degradedByFeed: true, degradedRid: null };
  }
}

/* =========================
   Page
========================= */

export default async function SuperadminPage() {
  const supabase = await supabaseServer();
  const cookieStore = await cookies();

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
  const localStats = buildStatsFromList(list);
  const { stats: apiStats, degradedByFeed, degradedRid } = await fetchDashboardStats(serializeCookies(cookieStore));
  const stats = mergeStats(apiStats, localStats);

  const systemState: SystemState =
    degradedByFeed || stats.companiesActive === null ? "DEGRADED" : computeSystemState(stats);

  // 7) Render
  return (
    <SuperadminClient
      initialCompanies={list}
      initialStats={stats}
      degradedRid={degradedRid}
      systemState={systemState}
    />
  );
}

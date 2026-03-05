// app/superadmin/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";

import SuperadminClient from "./superadmin-client";
import { normalizeSuperadminStats, nullSuperadminStats, type SuperadminStats } from "./types";
import { supabaseServer } from "@/lib/supabase/server";
import PageSection from "@/components/layout/PageSection";
import BlockedAccess from "@/components/auth/BlockedAccess";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { getOverlayBySlug } from "@/lib/cms/public/getOverlayByKey";
import { APP_OVERLAYS } from "@/lib/cms/overlays/registry";
import { renderOverlaySlot } from "@/lib/public/blocks/renderOverlaySlot";

// ✅ Oslo single source of truth (for display in superadmin)
import {
  OSLO_TZ,
  osloNowParts,
  osloNowISO,
  osloTodayISODate,
  osloTodayNODate,
  isAfterCutoff0800,
  isAfterCutoff0805,
} from "@/lib/date/oslo";

type CompanyStatus = "pending" | "active" | "paused" | "closed";

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus; // UI: lowercase
  created_at: string;
  updated_at: string;
};

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
  return isCompanyStatus(s) ? (s as CompanyStatus) : "pending"; // ðŸ”’ aldri "active" som fallback
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
  const h = await headers(); // ✅ Next: may require await in your setup
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

  // ✅ Oslo time snapshot (server-side, no fetch, no refetch)
  const oslo = osloNowParts();
  const systemTimeLine = `${osloTodayNODate()} · ${String(oslo.hh).padStart(2, "0")}:${String(oslo.mi).padStart(
    2,
    "0"
  )}`;
  const cutoffLine = isAfterCutoff0800() ? "Cutoff: LÅST (08:00)" : "Cutoff: ÅPEN (til 08:00)";
  const cutoff0805Line = isAfterCutoff0805() ? "· 08:05: LÅST" : "· 08:05: ÅPEN";

  // 1) Auth
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      redirect("/login?next=/superadmin&code=NO_SESSION");
    }
    return <BlockedAccess reason={auth.reason} />;
  }

  if (auth.role !== "superadmin") {
    redirect("/login?next=/superadmin&code=ROLE_FORBIDDEN");
  }

  // 2) Companies (seed list)
  const { data: companies, error: cErr } = await supabase
    .from("companies")
    .select("id,name,orgnr,status,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (cErr) {
    return <ErrorSurface message="Klarte ikke å hente firmalisten." detail={safeStr(cErr.message)} />;
  }

  // 4) Normalize
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

  // 5) Stats + signals
  const localStats = buildStatsFromList(list);
  const { stats: apiStats, degradedByFeed, degradedRid } = await fetchDashboardStats(serializeCookies(cookieStore));
  const stats = mergeStats(apiStats, localStats);

  const systemState: SystemState =
    degradedByFeed || stats.companiesActive === null ? "DEGRADED" : computeSystemState(stats);

  const overlay = await getOverlayBySlug(APP_OVERLAYS.superadmin.slug, { locale: "nb", environment: "prod" });
  const topBanner = overlay.ok ? renderOverlaySlot(overlay.blocks, "topBanner", "prod", "nb") : null;
  const headerSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "header", "prod", "nb") : null;
  const helpSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "help", "prod", "nb") : null;
  const footerCtaSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "footerCta", "prod", "nb") : null;

  // 6) Render
  return (
    <>
      {topBanner ? <div className="mx-auto w-full max-w-[1400px] px-4 pt-4">{topBanner}</div> : null}
      {headerSlot ? <div className="mx-auto w-full max-w-[1400px] px-4">{headerSlot}</div> : null}
      {/* ✅ Oslo time / cutoff banner (server truth) */}
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-4">
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 px-4 py-3 text-sm text-[rgb(var(--lp-muted))]">
          <span className="font-semibold text-[rgb(var(--lp-fg))]">Systemtid (Oslo):</span>{" "}
          <span className="text-[rgb(var(--lp-fg))]">{systemTimeLine}</span>{" "}
          <span className="ml-2">{cutoffLine}</span>{" "}
          <span className="opacity-80">{cutoff0805Line}</span>
          <span className="ml-2 opacity-70">({OSLO_TZ})</span>
          <span className="ml-3 opacity-60">· {osloNowISO()}</span>
          <span className="ml-2 opacity-60">· i dag ISO: {osloTodayISODate()}</span>
        </div>
      </div>

      <SuperadminClient
        initialCompanies={list}
        initialStats={stats}
        degradedRid={degradedRid}
        systemState={systemState}
      />
      {helpSlot ? <div className="mx-auto w-full max-w-[1400px] px-4 mt-6">{helpSlot}</div> : null}
      {footerCtaSlot ? <div className="mx-auto w-full max-w-[1400px] px-4 mt-6">{footerCtaSlot}</div> : null}
    </>
  );
}



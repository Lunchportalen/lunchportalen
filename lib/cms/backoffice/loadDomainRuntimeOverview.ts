import "server-only";

import {
  CONTROL_PLANE_RUNTIME_MODULES,
  type ControlPlaneModuleStatus,
} from "@/lib/cms/controlPlaneRuntimeStatusData";
import {
  aggregateLocationCounts,
  type CompanyRowPreview,
} from "@/lib/cms/backoffice/domainRuntimeOverviewShared";
import { loadControlPlaneRuntimeSnapshot } from "@/lib/cms/backoffice/loadControlPlaneRuntimeSnapshot";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function subDaysISO(dateISO: string, days: number) {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return isoDate(d);
}

export type DomainRuntimeOverviewResult =
  | {
      ok: true;
      snapshot: {
        companies: { total: number; active: number; pending: number; paused: number; closed: number };
        locations: number;
        activeAgreements: number;
      };
      companyRows: CompanyRowPreview[];
      orders7d: { from: string; to: string; total: number };
      moduleStatuses: ControlPlaneModuleStatus[];
    }
  | { ok: false; message: string };

/**
 * Samlet read-only oversikt for CMS control plane (orkestrering).
 * Ingen mutasjon; samme gate som loadControlPlaneRuntimeSnapshot.
 */
export async function loadDomainRuntimeOverview(): Promise<DomainRuntimeOverviewResult> {
  try {
    const { supabaseServer } = await import("@/lib/supabase/server");
    const sb = await supabaseServer();
    const { data: auth, error: aerr } = await sb.auth.getUser();
    if (aerr || !auth?.user) return { ok: false, message: "Ikke innlogget." };
    if (!(await isSuperadminProfile(auth.user.id))) return { ok: false, message: "Kun superadmin." };

    if (!hasSupabaseAdminConfig()) {
      return { ok: false, message: "Admin-konfigurasjon mangler (service role)." };
    }

    const base = await loadControlPlaneRuntimeSnapshot();
    if (base.ok === false) return { ok: false, message: base.message };

    const admin = supabaseAdmin();

    const { data: companies, error: cErr } = await admin
      .from("companies")
      .select("id,name,status,updated_at,agreement_json")
      .order("updated_at", { ascending: false })
      .limit(48);
    if (cErr) return { ok: false, message: cErr.message };

    const { data: locRows, error: lErr } = await admin.from("company_locations").select("company_id");
    if (lErr) return { ok: false, message: lErr.message };
    const locByCompany = aggregateLocationCounts((locRows ?? []) as Array<{ company_id?: string | null }>);

    const companyRows: CompanyRowPreview[] = (companies ?? []).map((row) => {
      const id = String((row as { id?: string }).id ?? "");
      return {
        id,
        name: (row as { name?: string | null }).name ?? null,
        status: (row as { status?: string | null }).status ?? null,
        updated_at: (row as { updated_at?: string | null }).updated_at ?? null,
        agreement_json: (row as { agreement_json?: unknown }).agreement_json ?? null,
        locationCount: locByCompany.get(id) ?? 0,
      };
    });

    const today = isoDate(new Date());
    const from = subDaysISO(today, 6);
    const { count: orderCount, error: oErr } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("date", from)
      .lte("date", today);
    if (oErr) return { ok: false, message: oErr.message };

    return {
      ok: true,
      snapshot: {
        companies: base.companies,
        locations: base.locations,
        activeAgreements: base.activeAgreements,
      },
      companyRows,
      orders7d: { from, to: today, total: orderCount ?? 0 },
      moduleStatuses: CONTROL_PLANE_RUNTIME_MODULES,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Ukjent feil." };
  }
}

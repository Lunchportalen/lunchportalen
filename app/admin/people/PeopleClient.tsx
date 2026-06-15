"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import AdminTechnicalDetails from "@/components/admin/AdminTechnicalDetails";
import EmployeesTable from "@/components/admin/EmployeesTable";
import InvitesPanel from "@/components/admin/InvitesPanel";
import SupportReportButton from "@/components/admin/SupportReportButton";
import AdminPageShell from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { getCardVariantClass } from "@/components/ui/card";
import {
  PEOPLE_INVITES_ACCORDION_NOTE,
  PEOPLE_LIST_TITLE,
  PEOPLE_ONBOARDING_EMPTY_BODY,
  PEOPLE_ONBOARDING_EMPTY_TITLE,
  PEOPLE_READINESS_HAS_EMPLOYEES,
  PEOPLE_READINESS_NEXT_INVITE,
  PEOPLE_SUPPORT_ACCORDION_NOTE,
  SUPPORT_BUTTON_LABEL,
  TECHNICAL_DETAILS_SUMMARY,
  peopleListScopeNote,
} from "@/lib/admin/companyAdminCopy";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

type EmployeeRow = {
  user_id: string;
  email: string | null;
  role: "employee" | "company_admin" | "superadmin" | "kitchen" | "driver" | null;
  department: string | null;
  location_id: string | null;
  disabled_at: string | null;
  disabled_reason?: string | null;
  is_active?: boolean | null;
  name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type InviteRow = {
  id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  location_id: string | null;
  created_at: string | null;
  last_sent_at: string | null;
  expires_at: string | null;
  used_at: string | null;
};

type PeopleData = {
  company: { id: string; name: string | null; status: string | null; updated_at: string | null } | null;
  employees: EmployeeRow[];
  counts: { total: number; active: number; deactivated: number };
  invites: InviteRow[];
  inviteCounts: { total: number; active: number; used: number; expired: number };
  source: { companyId: string; updatedAt: string | null };
};

type ApiOk = { ok: true; rid: string; data: PeopleData };
type ApiErr = { ok: false; rid: string; error: string; message?: string; status?: number };

type LocationRow = { id: string; name: string | null };

async function readJsonOrThrow(res: Response) {
  const text = await res.text();
  if (!text) throw new Error(`Server returnerte tom respons (HTTP ${res.status}).`);
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Server returnerte ikke JSON (HTTP ${res.status}).`);
  }
  return json;
}

export default function PeopleClient({
  initialQuery,
  viewerEmail,
  supportCompanyId,
  supportLocationId,
}: {
  initialQuery: string;
  viewerEmail: string | null;
  supportCompanyId: string;
  supportLocationId: string | null;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PeopleData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);
  const [locationLabels, setLocationLabels] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState(initialQuery);

  async function load(opts?: { keepError?: boolean }) {
    setLoading(true);
    if (!opts?.keepError) setErr(null);

    try {
      const res = await fetch("/api/admin/people", { headers: { "cache-control": "no-store" } });
      const json = (await readJsonOrThrow(res)) as ApiOk | ApiErr;

      if (!res.ok || !json || (json as any).ok !== true) {
        const j = json as ApiErr;
        setRid(j?.rid ?? null);
        throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
      }

      const ok = json as ApiOk;
      setRid(ok.rid);
      setData(ok.data);
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente ansatte.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const companyId = data?.company?.id ?? supportCompanyId;
    if (!companyId) return;

    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/locations?companyId=${encodeURIComponent(companyId)}`, {
          headers: { "cache-control": "no-store" },
        });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          data?: { locations?: LocationRow[] };
          locations?: LocationRow[];
        } | null;
        if (!alive || !res.ok || !json || json.ok !== true) return;
        const payload = json.data ?? json;
        const locations = Array.isArray(payload?.locations) ? payload.locations : [];
        const map: Record<string, string> = {};
        for (const loc of locations) {
          if (loc.id) map[loc.id] = loc.name?.trim() || "Lokasjon";
        }
        setLocationLabels(map);
      } catch {
        /* optional enrichment */
      }
    })();

    return () => {
      alive = false;
    };
  }, [data?.company?.id, supportCompanyId]);

  const counts = data?.counts ?? { total: 0, active: 0, deactivated: 0 };
  const companyName = data?.company?.name ?? "Firma";
  const employeeRows = (data?.employees ?? []).filter((row) => row.role === "employee");
  const invitedEmployees = employeeRows.length;
  const showOnboardingHero = !loading && !err && invitedEmployees === 0;

  const sourceMeta = useMemo(() => {
    return {
      companyId: data?.source?.companyId ?? supportCompanyId,
      updatedAt: data?.source?.updatedAt ?? null,
      rid: rid ?? null,
    };
  }, [data?.source?.companyId, data?.source?.updatedAt, rid, supportCompanyId]);

  return (
    <AdminPageShell
      title="Ansatte"
      subtitle={`Inviter ansatte til ${companyName}. Ansatte må være lagt til før de kan bestille lunsj.`}
      actions={
        <>
          <Button asChild className="lp-neon-focus lp-neon-glow-hover">
            <Link href="/admin/invite">Inviter ansatt</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/invite">Inviter via e-postliste</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/admin/export/employees.csv">Last ned CSV</Link>
          </Button>
        </>
      }
    >
      <section className={cn("lp-card", getCardVariantClass("soft"), "p-4 sm:p-5")}>
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
          <span className="font-semibold text-[rgb(var(--lp-text))]">
            {loading ? "Laster…" : err ? "Ikke tilgjengelig" : `${counts.active} aktiv`}
          </span>
          <span className="text-[rgb(var(--lp-muted))]">
            {loading ? "…" : err ? "…" : `${counts.deactivated} deaktiverte`}
          </span>
        </div>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          {invitedEmployees === 0 ? PEOPLE_READINESS_NEXT_INVITE : PEOPLE_READINESS_HAS_EMPLOYEES}
        </p>
      </section>

      {showOnboardingHero ? (
        <section className="lp-card lp-card--elevated p-6 text-center sm:text-left">
          <h2 className="text-lg font-semibold text-[rgb(var(--lp-text))]">{PEOPLE_ONBOARDING_EMPTY_TITLE}</h2>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{PEOPLE_ONBOARDING_EMPTY_BODY}</p>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Firmaadmin-kontoen er for administrasjon. Inviter minst én ansatt som skal bestille lunsj.
          </p>
        </section>
      ) : null}

      {err ? (
        <section className="lp-card p-6">
          <div className="text-sm text-[rgb(var(--lp-muted))]">Kunne ikke hente ansatte. {err}</div>
          {rid ? (
            <AdminTechnicalDetails
              className="mt-3"
              rows={[{ label: "RID", value: rid }]}
            />
          ) : null}
        </section>
      ) : null}

      <section className="lp-panel overflow-hidden">
        <div className="border-b border-[rgb(var(--lp-border))] px-6 py-4">
          <h2 className="lp-h2">{PEOPLE_LIST_TITLE}</h2>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{peopleListScopeNote(companyName)}</p>
          <div className="mt-4">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Søk navn eller e-post"
              aria-label="Søk ansatte"
              className="w-full max-w-md min-h-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4">
          <EmployeesTable
            companyId={data?.company?.id ?? supportCompanyId}
            companyName={data?.company?.name ?? null}
            viewerEmail={viewerEmail}
            canInvite={false}
            showToolbarActions={false}
            searchQuery={searchQuery}
            employees={data?.employees ?? []}
            loading={loading}
            error={err}
            locationLabels={locationLabels}
            onReload={load}
          />
        </div>
      </section>

      <details className={cn("lp-card lp-motion-card", getCardVariantClass("soft"), "p-6")}>
        <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--lp-text))]">Invitasjoner</summary>
        <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">{PEOPLE_INVITES_ACCORDION_NOTE}</p>
        <div className="mt-4">
          <InvitesPanel rows={data?.invites ?? []} loading={loading} error={err} onReload={load} />
        </div>
      </details>

      <details className={cn("lp-card lp-motion-card", getCardVariantClass("soft"), "p-6")}>
        <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--lp-text))]">Support</summary>
        <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">{PEOPLE_SUPPORT_ACCORDION_NOTE}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SupportReportButton
            reason="COMPANY_ADMIN_PEOPLE_SUPPORT_REPORT"
            companyId={supportCompanyId}
            locationId={supportLocationId}
            buttonLabel={SUPPORT_BUTTON_LABEL}
            buttonClassName="lp-btn lp-btn--secondary"
          />
        </div>
      </details>

      <AdminTechnicalDetails
        className={cn("lp-card lp-motion-card", getCardVariantClass("soft"), "p-6")}
        summary={TECHNICAL_DETAILS_SUMMARY}
        rows={[
          { label: "company_id", value: sourceMeta.companyId || "Ikke tilgjengelig" },
          { label: "updated_at", value: sourceMeta.updatedAt || "Ikke tilgjengelig" },
          { label: "rid", value: sourceMeta.rid || "Ikke tilgjengelig" },
        ]}
      />
    </AdminPageShell>
  );
}

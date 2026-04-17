"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import EmployeesTable from "@/components/admin/EmployeesTable";
import InvitesPanel from "@/components/admin/InvitesPanel";
import SupportReportButton from "@/components/admin/SupportReportButton";
import AdminPageShell from "@/components/admin/AdminPageShell";
import { Button } from "@/components/ui/button";
import { Card, getCardVariantClass } from "@/components/ui/card";

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

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs uppercase tracking-[0.08em] text-[rgb(var(--lp-muted))]">{label}</div>
      <div className="text-base font-semibold text-[rgb(var(--lp-text))]">{value}</div>
    </div>
  );
}

function statValue(v: number | null | undefined) {
  return v == null ? "Ikke tilgjengelig" : String(v);
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

  const counts = data?.counts ?? { total: 0, active: 0, deactivated: 0 };
  const companyName = data?.company?.name ?? "Firma";

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
      subtitle="Inviter, deaktiver og hold kontroll. Lesetilgang til avtale-rammer."
      actions={
        <>
          <Button asChild className="lp-neon-focus lp-neon-glow-hover">
            <Link href="/admin/invite">Inviter</Link>
          </Button>
          <details className="relative">
            <summary className="lp-btn lp-btn--ghost min-h-[44px] cursor-pointer list-none border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-2 text-sm font-semibold">
              Flere
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-56 rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-2 shadow-[var(--lp-shadow-soft)]">
              <Link href="/admin/export/employees.csv" className="block rounded-xl px-3 py-2 text-sm hover:bg-[rgb(var(--lp-surface-alt))]">
                Last ned CSV
              </Link>
              <Link href="/admin/invite" className="block rounded-xl px-3 py-2 text-sm hover:bg-[rgb(var(--lp-surface-alt))]">
                Inviter flere
              </Link>
            </div>
          </details>
        </>
      }
    >
      <section className="lp-card p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Firmaadmin · {companyName} · Ansatte</div>
            <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Kun ansatte i ditt firma vises.</div>
          </div>
          {viewerEmail ? <div className="text-xs text-[rgb(var(--lp-muted))]">Innlogget: {viewerEmail}</div> : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <StatItem label="Totalt" value={loading ? "Laster…" : err ? "Ikke tilgjengelig" : statValue(counts.total)} />
          <StatItem label="Aktive" value={loading ? "Laster…" : err ? "Ikke tilgjengelig" : statValue(counts.active)} />
          <StatItem label="Deaktivert" value={loading ? "Laster…" : err ? "Ikke tilgjengelig" : statValue(counts.deactivated)} />
        </div>
      </section>

      {err ? (
        <section className="lp-card p-6">
          <div className="text-sm text-[rgb(var(--lp-muted))]">Kunne ikke hente ansatte. {err}{rid ? ` RID: ${rid}` : ""}</div>
        </section>
      ) : null}

      <section className="lp-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[rgb(var(--lp-border))] px-6 py-4">
          <div>
            <h2 className="lp-h2">Ansatte</h2>
            <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Full bredde, tenant-sikker tabell.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <form action="/admin/people" method="get" className="flex items-center gap-2">
              <input
                name="q"
                defaultValue={initialQuery}
                placeholder="Søk navn, e-post"
                className="min-h-[40px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm"
              />
              <button className="lp-btn lp-btn--secondary min-h-[40px]">Søk</button>
            </form>
          </div>
        </div>

        <div className="px-6 py-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-1 text-xs text-[rgb(var(--lp-text))]">Alle</span>
            <span className="rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1 text-xs text-[rgb(var(--lp-muted))]">Aktive</span>
            <span className="rounded-full border border-[rgb(var(--lp-border))] bg-white/70 px-3 py-1 text-xs text-[rgb(var(--lp-muted))]">Deaktivert</span>
          </div>
          <EmployeesTable
            companyId={data?.company?.id ?? supportCompanyId}
            companyName={data?.company?.name ?? null}
            viewerEmail={viewerEmail}
            canInvite
            initialQuery={initialQuery}
            employees={data?.employees ?? []}
            loading={loading}
            error={err}
            onReload={load}
          />
        </div>
      </section>

      <details className={cn("lp-card lp-motion-card", getCardVariantClass("soft"), "p-6")}>
        <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--lp-text))]">Invitasjoner</summary>
        <div className="mt-4">
          <InvitesPanel rows={data?.invites ?? []} loading={loading} error={err} onReload={load} />
        </div>
      </details>

      <details className={cn("lp-card lp-motion-card", getCardVariantClass("soft"), "p-6")}>
        <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--lp-text))]">Support</summary>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SupportReportButton
            reason="COMPANY_ADMIN_PEOPLE_SUPPORT_REPORT"
            companyId={supportCompanyId}
            locationId={supportLocationId}
            buttonLabel="Send systemrapport"
            buttonClassName="lp-btn lp-btn--secondary"
          />
          <div className="text-sm text-[rgb(var(--lp-muted))]">
            Rapporten inkluderer firma, lokasjon og tidspunkt.
          </div>
        </div>
      </details>

      <details className={cn("lp-card lp-motion-card", getCardVariantClass("soft"), "p-6")}>
        <summary className="cursor-pointer text-sm font-semibold text-[rgb(var(--lp-text))]">Kilde til sannhet</summary>
        <div className="mt-3 text-sm text-[rgb(var(--lp-text))]">
          companyId: {sourceMeta.companyId || "Ikke tilgjengelig"} · updatedAt: {sourceMeta.updatedAt || "Ikke tilgjengelig"} · rid: {sourceMeta.rid || "Ikke tilgjengelig"}
        </div>
      </details>
    </AdminPageShell>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Lead = {
  id: string;
  companyName: string;
  industry: string;
  employees: number;
  location: string;
  status: string;
};

type PhaseCounts = {
  new: number;
  contacted: number;
  qualified: number;
  closed: number;
};

type GoLivePayload = {
  generatedAt: string;
  leads: Lead[];
  phaseCounts: PhaseCounts;
  qualifiedCount: number;
  conversionRate: number | null;
  revenue: {
    mrrNok: number;
    arrNok: number;
    recordCount: number;
  };
};

type ApiOk = { ok: true; rid: string; data: GoLivePayload };
type ApiErr = { ok: false; message?: string };
type ApiResp = ApiOk | ApiErr;

const ACTIONS = [
  { href: "/superadmin/growth/social", label: "Kontakt lead", param: "contact" },
  { href: "/superadmin/growth/social", label: "Oppfølging", param: "followup" },
  { href: "/superadmin/growth/social", label: "Lukk avtale", param: "close" },
] as const;

function phaseNb(k: keyof PhaseCounts): string {
  if (k === "new") return "Ny";
  if (k === "contacted") return "Kontaktet";
  if (k === "qualified") return "Kvalifisert";
  return "Lukket";
}

export default function GoLiveEnginePanel() {
  const [data, setData] = useState<GoLivePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchJson = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/superadmin/control-tower/golive", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json()) as ApiResp;
      if (j?.ok === true && j.data) setData(j.data);
      else {
        setErr((j as ApiErr)?.message ?? "Kunne ikke laste Go Live.");
        setData(null);
      }
    } catch {
      setErr("Nettverksfeil.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJson();
  }, [fetchJson]);

  const phases: (keyof PhaseCounts)[] = ["new", "contacted", "qualified", "closed"];

  return (
    <section
      className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-6"
      id="go-live-motor"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Go Live-motor</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Leads, pipeline, konvertering og omsetning — prosessminne (synk mot CRM anbefales).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchJson()}
          disabled={loading}
          className="rounded-full border border-[rgb(var(--lp-border))] px-3 py-1.5 text-sm text-[rgb(var(--lp-fg))] hover:bg-[rgb(var(--lp-muted))]/10 disabled:opacity-50"
        >
          {loading ? "Oppdaterer…" : "Oppdater"}
        </button>
      </div>

      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

      {loading && !data ? (
        <p className="mt-6 text-sm text-[rgb(var(--lp-muted))]">Laster…</p>
      ) : null}

      {data ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/40 px-3 py-2">
              <div className="text-[rgb(var(--lp-muted))]">Kvalifiserte (ICP)</div>
              <div className="font-medium tabular-nums text-[rgb(var(--lp-fg))]">{data.qualifiedCount}</div>
            </div>
            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/40 px-3 py-2">
              <div className="text-[rgb(var(--lp-muted))]">Konvertering</div>
              <div className="font-medium tabular-nums text-[rgb(var(--lp-fg))]">
                {data.conversionRate == null
                  ? "—"
                  : `${(data.conversionRate * 100).toFixed(1)} %`}
              </div>
            </div>
            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/40 px-3 py-2">
              <div className="text-[rgb(var(--lp-muted))]">MRR (NOK)</div>
              <div className="font-medium tabular-nums text-[rgb(var(--lp-fg))]">
                {data.revenue.mrrNok.toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/40 px-3 py-2">
              <div className="text-[rgb(var(--lp-muted))]">ARR (proxy, NOK)</div>
              <div className="font-medium tabular-nums text-[rgb(var(--lp-fg))]">
                {data.revenue.arrNok.toLocaleString("nb-NO", { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Pipeline — antall per fase</h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {phases.map((k) => (
                <div
                  key={k}
                  className="flex items-center justify-between rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
                >
                  <span className="text-[rgb(var(--lp-muted))]">{phaseNb(k)}</span>
                  <span className="font-medium tabular-nums text-[rgb(var(--lp-fg))]">{data.phaseCounts[k]}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Leads</h3>
            {data.leads.length === 0 ? (
              <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
                Ingen leads i register — koble mot CRM eller fyll pipeline programmatisk.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {data.leads.slice(0, 25).map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm text-[rgb(var(--lp-fg))]"
                  >
                    <span className="font-medium">{l.companyName}</span>
                    <span className="text-xs text-[rgb(var(--lp-muted))]">
                      {l.employees} ans · {l.status} · {l.location}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Handlinger</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {ACTIONS.map((a) => (
                <Link
                  key={a.param}
                  href={`${a.href}?golive=${encodeURIComponent(a.param)}`}
                  className="rounded-full border border-[rgb(var(--lp-border))] px-3 py-1.5 text-sm text-[rgb(var(--lp-fg))] hover:bg-[rgb(var(--lp-muted))]/10"
                >
                  {a.label}
                </Link>
              ))}
            </div>
            <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
              Omsetning: {data.revenue.recordCount} kunder med MRR i spor.
            </p>
          </div>

          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Data: {new Date(data.generatedAt).toLocaleString("nb-NO", { timeZone: "Europe/Oslo" })}
          </p>
        </div>
      ) : null}
    </section>
  );
}

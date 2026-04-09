"use client";

import { useCallback, useState } from "react";

import DataTrustBadge from "@/components/superadmin/DataTrustBadge";
import type { InvestorValuationPayload } from "@/lib/finance/runInvestorValuation";
import { apiErrorMessageFromJson } from "@/lib/ui/apiErrorMessage";

function formatKr(n: number): string {
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 }).format(n);
}

function formatPct(r: number): string {
  return new Intl.NumberFormat("nb-NO", { style: "percent", maximumFractionDigits: 1 }).format(r);
}

type Props = { initial: InvestorValuationPayload };

function parseInvestorErrBody(j: unknown, fallback: string): string {
  if (j && typeof j === "object") {
    const o = j as { message?: unknown; error?: unknown };
    const m = typeof o.message === "string" ? o.message.trim() : "";
    if (m) return m;
    const e = typeof o.error === "string" ? o.error.trim() : "";
    if (e) return e;
  }
  return fallback;
}

export default function InvestorDashboardClient({ initial }: Props) {
  const [data, setData] = useState<InvestorValuationPayload>(initial);
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(false);
  const [refreshErr, setRefreshErr] = useState<string | null>(null);

  const refresh = useCallback(async (withLog: boolean) => {
    setBusy(true);
    setLogged(false);
    setRefreshErr(null);
    try {
      const res = await fetch("/api/investor/valuation", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ log: withLog }),
        cache: "no-store",
      });
      let j: unknown;
      try {
        j = await res.json();
      } catch {
        setRefreshErr("Ugyldig svar fra server (kunne ikke lese JSON).");
        return;
      }
      const payload = j as { ok?: boolean; data?: InvestorValuationPayload };
      if (res.ok && payload.ok === true && payload.data) {
        setData(payload.data);
        if (withLog) setLogged(true);
        return;
      }
      setRefreshErr(
        apiErrorMessageFromJson(j, res.ok ? "Oppdatering avbrutt (mangler data)." : `HTTP ${res.status}: Kunne ikke oppdatere tall.`),
      );
    } catch (e) {
      setRefreshErr(e instanceof Error ? e.message : "Nettverksfeil ved oppdatering.");
    } finally {
      setBusy(false);
    }
  }, []);

  const { kpis, arr, growthRate, valuation, scenarios } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh(false)}
          className="rounded-full border border-neutral-900 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
        >
          {busy ? "Oppdaterer…" : "Oppdater tall"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh(true)}
          className="rounded-full border border-neutral-900 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white disabled:opacity-50"
        >
          {busy ? "Oppdaterer…" : "Oppdater og logg (audit)"}
        </button>
        {logged ? <span className="text-xs text-[rgb(var(--lp-muted))]">Logget som valuation_run.</span> : null}
      </div>

      {refreshErr ? (
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{refreshErr}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh(false)}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border border-red-800 bg-white px-4 py-2 text-sm font-medium text-red-900 hover:bg-red-100 disabled:opacity-50"
          >
            Prøv igjen
          </button>
        </div>
      ) : null}

      <section
        className="grid grid-cols-1 gap-3 rounded-lg border border-black/10 bg-white/70 p-4 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Hoved-KPI"
      >
        <div className="col-span-full mb-1 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Hoved-KPI</span>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <div className="rounded-lg border border-black/5 bg-white/90 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">ARR (indikator)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">{formatKr(arr.arr)} kr</p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white/90 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Verdivurdering (ARR×multiple)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">{formatKr(valuation.valuation)} kr</p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white/90 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Multiple</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">{valuation.multiple}×</p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white/90 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Vekst (halvdeler)</p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-900">{formatPct(growthRate)}</p>
        </div>
      </section>

      <section className="rounded-lg border border-black/10 bg-white/70 p-4" aria-label="Pipeline">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Pipeline</h2>
          <DataTrustBadge kind="REAL" />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-black/5 bg-white/90 p-3 text-sm">
            <p className="text-[10px] uppercase text-[rgb(var(--lp-muted))]">Nominell verdi</p>
            <p className="mt-1 tabular-nums font-medium">{formatKr(kpis.pipelineGross)} kr</p>
          </div>
          <div className="rounded border border-black/5 bg-white/90 p-3 text-sm">
            <p className="text-[10px] uppercase text-[rgb(var(--lp-muted))]">Vektet prognose</p>
            <p className="mt-1 tabular-nums font-medium">{formatKr(kpis.weightedPipeline)} kr</p>
          </div>
        </div>
        <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Antall deals i pipeline: {kpis.deals}</p>
      </section>

      <section className="rounded-lg border border-black/10 bg-white/70 p-4" aria-label="Scenarioer">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Scenarioer (sensitivitet)</h2>
          <DataTrustBadge kind="ESTIMATED" />
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex justify-between rounded border border-black/5 bg-white/90 px-3 py-2">
            <span>Nedsider (×0,7)</span>
            <span className="tabular-nums font-medium">{formatKr(scenarios.downside)} kr</span>
          </li>
          <li className="flex justify-between rounded border border-black/5 bg-white/90 px-3 py-2">
            <span>Basis</span>
            <span className="tabular-nums font-medium">{formatKr(scenarios.base)} kr</span>
          </li>
          <li className="flex justify-between rounded border border-black/5 bg-white/90 px-3 py-2">
            <span>Oppsider (×1,5)</span>
            <span className="tabular-nums font-medium">{formatKr(scenarios.upside)} kr</span>
          </li>
        </ul>
        <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">{scenarios.explain.join(" ")}</p>
      </section>

      <section className="rounded-lg border border-dashed border-black/15 bg-white/60 p-4 text-xs text-neutral-800">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-900">Forklaring (revisjon)</h2>
          <DataTrustBadge kind="REAL" />
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Total ordreomsetning (reell): {formatKr(kpis.revenue)} kr</li>
          <li>{arr.explain.join(" ")}</li>
          <li>{valuation.explain.join(" ")}</li>
          <li>{data.growthExplain.join(" ")}</li>
        </ul>
        <p className="mt-3 text-[10px] text-[rgb(var(--lp-muted))]">{data.sources.join(" ")}</p>
      </section>
    </div>
  );
}

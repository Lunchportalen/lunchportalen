"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { buildEsgNarrativeYear } from "@/lib/esg/narrative";
import { fmtCo2e, fmtKg, fmtNok, fmtNum, fmtMonthLabel } from "@/lib/esg/format";

type MonthRow = {
  month: string;
  ordered_count: number;
  cancelled_in_time_count: number;
  waste_meals: number;
  waste_kg: number;
  waste_co2e_kg: number;
  cost_saved_nok: number;
  cost_waste_nok: number;
  cost_net_nok: number;
  stability_score: string | null;
};

type YearRow = {
  year: number;
  ordered_count: number;
  cancelled_in_time_count: number;
  waste_meals: number;
  waste_kg: number;
  waste_co2e_kg: number;
  cost_saved_nok: number;
  cost_waste_nok: number;
  cost_net_nok: number;
  stability_score: string | null;
};

type SummaryPayload = { company_id: string; year: number; months: MonthRow[]; yearly: YearRow | null };
type ApiErr = { ok: false; message?: string; error?: string };

type RollupItem = {
  company: { id: string; name: string };
  month: string;
  delivered_count: number;
  cancelled_count: number;
  delivery_rate: number;
  waste_estimate_kg: number;
  co2_estimate_kg: number;
};

type RollupBaseline = {
  degraded?: boolean;
  operatorMessage?: string | null;
  operatorAction?: string | null;
};

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) throw new Error(`Tom respons (HTTP ${res.status})`);
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(`Ugyldig JSON (HTTP ${res.status})`);
  }
}

function badge(score: string | null) {
  const s = (score ?? "").toUpperCase();
  const base = "inline-flex items-center rounded-full px-2 py-1 text-xs font-bold ring-1";
  if (s === "A") return <span className={`${base} bg-emerald-50 text-emerald-800 ring-emerald-200`}>A</span>;
  if (s === "B") return <span className={`${base} bg-lime-50 text-lime-800 ring-lime-200`}>B</span>;
  if (s === "C") return <span className={`${base} bg-amber-50 text-amber-900 ring-amber-200`}>C</span>;
  if (s === "D") return <span className={`${base} bg-rose-50 text-rose-900 ring-rose-200`}>D</span>;
  return <span className={`${base} bg-white/60 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))]`}>—</span>;
}

export default function EsgRuntimeClient() {
  const [rollupLoading, setRollupLoading] = useState(true);
  const [rollupMonth, setRollupMonth] = useState<string | null>(null);
  const [rollupItems, setRollupItems] = useState<RollupItem[]>([]);
  const [rollupErr, setRollupErr] = useState<string | null>(null);
  const [rollupBaseline, setRollupBaseline] = useState<RollupBaseline | null>(null);
  const [q, setQ] = useState("");

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [sumLoading, setSumLoading] = useState(false);
  const [summary, setSummary] = useState<SummaryPayload | null>(null);
  const [sumErr, setSumErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setRollupLoading(true);
        const res = await fetch("/api/backoffice/esg/latest-monthly", { cache: "no-store" });
        const j = await readJson(res);
        if (!alive) return;
        if (!res.ok || j?.ok === false) {
          const msg = j?.message ?? j?.error ?? `HTTP ${res.status}`;
          throw new Error(String(msg));
        }
        const data = j?.data as { month?: string | null; items?: RollupItem[]; baseline?: RollupBaseline } | undefined;
        setRollupMonth(typeof data?.month === "string" ? data.month : null);
        setRollupItems(Array.isArray(data?.items) ? data.items : []);
        setRollupBaseline(data?.baseline ?? null);
        setRollupErr(null);
      } catch (e: unknown) {
        if (!alive) return;
        setRollupErr(String((e as Error)?.message ?? e));
        setRollupItems([]);
        setRollupMonth(null);
        setRollupBaseline(null);
      } finally {
        if (alive) setRollupLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const loadSummary = useCallback(async (cid: string) => {
    setSumLoading(true);
    setSumErr(null);
    try {
      const res = await fetch(`/api/backoffice/esg/summary?company_id=${encodeURIComponent(cid)}`, {
        cache: "no-store",
      });
      const j = await readJson(res);
      if (!res.ok || !j || j.ok === false) {
        const msg = (j as ApiErr)?.message ?? (j as ApiErr)?.error ?? `HTTP ${res.status}`;
        throw new Error(String(msg));
      }
      const payload = j.data as SummaryPayload | undefined;
      if (payload?.company_id) {
        setSummary({
          company_id: payload.company_id,
          year: payload.year,
          months: Array.isArray(payload.months) ? payload.months : [],
          yearly: payload.yearly ?? null,
        });
      }
    } catch (e: unknown) {
      setSummary(null);
      setSumErr(String((e as Error)?.message ?? e));
    } finally {
      setSumLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!companyId) {
      setSummary(null);
      setSumErr(null);
      return;
    }
    void loadSummary(companyId);
  }, [companyId, loadSummary]);

  const filteredRollup = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rollupItems;
    return rollupItems.filter(
      (it) =>
        it.company.name.toLowerCase().includes(needle) || it.company.id.toLowerCase().includes(needle),
    );
  }, [rollupItems, q]);

  const narrative = useMemo(() => {
    const y = summary?.yearly;
    if (!y || !summary) return null;
    return buildEsgNarrativeYear({ current: y, previous: null, year: summary.year });
  }, [summary]);

  const snapshotEmpty = summary && (summary.months?.length ?? 0) === 0 && summary.yearly == null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-4">
      <section
        className="mb-8 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-5 shadow-sm"
        aria-labelledby="esg-trust-heading"
      >
        <h2 id="esg-trust-heading" className="text-sm font-semibold text-[rgb(var(--lp-text))]">
          Kilde og metode
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[rgb(var(--lp-muted))]">
          <li>
            <strong className="font-medium text-[rgb(var(--lp-text))]">Månedlige/årlige snapshots</strong> (
            <code className="rounded bg-black/5 px-1 text-xs">esg_monthly_snapshots</code>,{" "}
            <code className="rounded bg-black/5 px-1 text-xs">esg_yearly_snapshots</code>
            ) bygges av eksisterende cron/RPC-løp — tallene vises som de ligger i databasen.
          </li>
          <li>
            <strong className="font-medium text-[rgb(var(--lp-text))]">Rulleringsliste</strong> (
            <code className="rounded bg-black/5 px-1 text-xs">esg_monthly</code>) er et aggregat med estimater (
            f.eks. kg, CO₂e) — merket som <em>estimater</em> i tabellen under, ikke som målt faktura.
          </li>
          <li>
            Avbestilling «i tide» følger systemets cut-off (08:00 Europe/Oslo) i snapshot-beregningen — se teknisk
            dokumentasjon for detaljer.
          </li>
        </ul>
      </section>

      <section className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-chrome-bg))]/40 p-5">
        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Velg firma</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Listen under er hentet fra siste tilgjengelige måned i <code className="text-xs">esg_monthly</code>
          {rollupMonth ? ` (${rollupMonth}).` : "."}
        </p>
        {rollupBaseline?.degraded ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-3 text-sm text-amber-950">
            <p>{rollupBaseline.operatorMessage ?? "ESG-listen kjører i degradert kompatibilitetsmodus."}</p>
            {rollupBaseline.operatorAction ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-white/60 px-2.5 py-2 text-xs font-medium text-amber-900">
                Neste steg: {rollupBaseline.operatorAction}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="esg-co-search">
            Søk i firma
          </label>
          <input
            id="esg-co-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk på navn eller ID"
            className="w-full max-w-md rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm text-[rgb(var(--lp-text))] placeholder:text-[rgb(var(--lp-muted))] focus:outline-none focus:ring-2 focus:ring-[var(--lp-hotpink)]"
          />
        </div>

        {rollupLoading ? (
          <p className="mt-4 text-sm text-[rgb(var(--lp-muted))]">Laster firmaliste…</p>
        ) : rollupErr ? (
          <p className="mt-4 text-sm text-rose-700" role="alert">
            {rollupErr}
          </p>
        ) : filteredRollup.length === 0 ? (
          <p className="mt-4 text-sm text-[rgb(var(--lp-muted))]">
            Ingen rader i <code className="text-xs">esg_monthly</code> for valgt filter — kan ikke velge firma her.
            Snapshots kan fortsatt finnes; bruk direkte firmavalg i superadmin-ESG om nødvendig.
          </p>
        ) : (
          <ul className="mt-4 max-h-64 divide-y divide-black/5 overflow-auto rounded-xl border border-[rgb(var(--lp-border))] bg-white">
            {filteredRollup.map((it) => {
              const active = companyId === it.company.id;
              return (
                <li key={it.company.id}>
                  <button
                    type="button"
                    onClick={() => setCompanyId(it.company.id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition hover:bg-black/[0.03] ${
                      active ? "bg-[var(--lp-hotpink)]/10 ring-1 ring-[var(--lp-hotpink)]/30" : ""
                    }`}
                  >
                    <span className="font-medium text-[rgb(var(--lp-text))]">{it.company.name}</span>
                    <span className="text-xs text-[rgb(var(--lp-muted))]">
                      Levert {fmtNum(it.delivered_count)} · Avbestilt {fmtNum(it.cancelled_count)} · Svinn (est.){" "}
                      {fmtKg(it.waste_estimate_kg)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {!companyId ? (
        <p className="text-sm text-[rgb(var(--lp-muted))]">Velg et firma for å se snapshot-basert ESG for inneværende år.</p>
      ) : sumLoading ? (
        <p className="text-sm text-[rgb(var(--lp-muted))]">Laster snapshots…</p>
      ) : sumErr ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 text-sm text-rose-800" role="alert">
          {sumErr}
        </div>
      ) : summary ? (
        <div className="space-y-8">
          {snapshotEmpty ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
              <strong className="font-semibold">Ikke nok data i perioden:</strong> ingen månedssnapshot-rader eller tomt
              årssnapshot for dette firma. Dette er ikke et grønt resultat — bare manglende grunnlag i databasen.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/superadmin/esg/${encodeURIComponent(companyId)}`}
              className="inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-text))] hover:border-[var(--lp-hotpink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lp-hotpink)]"
            >
              Åpne full ESG (superadmin)
            </Link>
            <span className="text-xs text-[rgb(var(--lp-muted))]">PDF og eksport ligger på superadmin-flata.</span>
          </div>

          <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">År {summary.year}</div>
                <div className="mt-1 text-xl font-semibold text-[rgb(var(--lp-text))]">
                  Spart {fmtNok(summary.yearly?.cost_saved_nok ?? 0)} · Svinn {fmtKg(summary.yearly?.waste_kg ?? 0)}
                </div>
                <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
                  {fmtNum(summary.yearly?.ordered_count ?? 0)} bestillinger · Avbestilt i tide{" "}
                  {fmtNum(summary.yearly?.cancelled_in_time_count ?? 0)} · {fmtCo2e(summary.yearly?.waste_co2e_kg ?? 0)} (est.
                  fra snapshot)
                </div>
              </div>
              <div>{badge(summary.yearly?.stability_score ?? null)}</div>
            </div>
          </section>

          {narrative?.lines?.length ? (
            <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/60 p-5">
              <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Forklaring (snapshot-basert)</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-[rgb(var(--lp-muted))]">
                {narrative.lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80">
            <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
              <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Siste 12 måneder (snapshot)</h2>
              <span className="text-xs text-[rgb(var(--lp-muted))]">Kilde: DB</span>
            </div>
            <div className="divide-y divide-black/5">
              {(summary.months ?? []).map((m) => (
                <div key={m.month} className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-12 sm:items-center">
                  <div className="sm:col-span-3">
                    <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">{fmtMonthLabel(m.month)}</div>
                    <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
                      {fmtNum(m.ordered_count)} best. · {fmtNum(m.cancelled_in_time_count)} avbest. i tide
                    </div>
                  </div>
                  <div className="sm:col-span-3">
                    <div className="text-xs text-[rgb(var(--lp-muted))]">Spart</div>
                    <div className="text-sm font-semibold">{fmtNok(m.cost_saved_nok)}</div>
                  </div>
                  <div className="sm:col-span-3">
                    <div className="text-xs text-[rgb(var(--lp-muted))]">Svinn (kg)</div>
                    <div className="text-sm font-semibold">{fmtKg(m.waste_kg)}</div>
                    <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">{fmtCo2e(m.waste_co2e_kg)}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="text-xs text-[rgb(var(--lp-muted))]">Netto</div>
                    <div className="text-sm font-medium">{fmtNok(m.cost_net_nok)}</div>
                  </div>
                  <div className="sm:col-span-1 flex sm:justify-end">{badge(m.stability_score)}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

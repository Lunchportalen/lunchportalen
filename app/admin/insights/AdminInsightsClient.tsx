"use client";

import { useEffect, useMemo, useState } from "react";

type RangeKey = "7d" | "14d" | "30d";

type DaySummary = {
  date: string;
  orders: number;
  cancelled_before_cutoff: number;
  cancelled_after_cutoff: number;
};

type ApiOk = {
  ok: true;
  rid: string;
  data: {
    range: RangeKey;
    window: { from: string; to: string };
    deliveries: { total_orders: number; active_days: number; avg_orders_per_day: number | null };
    cancellations_before_cutoff: { count: number; total_cancelled: number; rate: number | null };
    cancellations_after_cutoff: { count: number };
    daily_summary: DaySummary[];
    delivery_stability: {
      available: boolean;
      days_with_no_deviations?: number;
      days_with_deviations?: number;
      note?: string;
      message?: string;
    };
  };
};

type ApiErr = { ok: false; rid?: string; error: string; message?: string; status?: number };

type DemandInsightsData = {
  transparencyNote: string;
  window: { from: string; to: string; days?: number };
  weekdayRanking: Array<{ weekday: string; label: string; avgActive: number; sampleDays: number }>;
  dishSignals: Array<{ choiceKey: string; count: number; signal: "high" | "low" | "neutral" }>;
  suggestions: string[];
  nextBusinessDayForecast: {
    date: string;
    predictedOrders: number;
    confidence: number;
    marginOfError: number;
    plannedWithBuffer: number;
    bufferPercent: number;
    explanation: string[];
  };
  waste: {
    rollup: {
      averageWastePercent: number | null;
      daysWithData: number;
      daysMissingProduction: number;
      transparencyNote: string;
    };
    note: string;
  };
};

function fmtNum(n: number | null | undefined, decimals = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: decimals }).format(n);
}

function fmtPercent(n: number | null | undefined, decimals = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${fmtNum(n * 100, decimals)} %`;
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="lp-glass-card rounded-3xl p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
      <div className="text-xs font-semibold text-neutral-600">{label}</div>
      <div className="mt-2 text-2xl font-extrabold text-neutral-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-neutral-600">{hint}</div> : null}
    </div>
  );
}

export default function AdminInsightsClient() {
  const [range, setRange] = useState<RangeKey>("7d");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiOk["data"] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  const [demandLoading, setDemandLoading] = useState(false);
  const [demandErr, setDemandErr] = useState<string | null>(null);
  const [demandData, setDemandData] = useState<DemandInsightsData | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);
      setRid(null);

      try {
        const res = await fetch(`/api/admin/insights?range=${range}`, { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as ApiOk | ApiErr | null;

        if (!alive) return;

        if (!res.ok || !json || (json as any).ok !== true) {
          const j = json as ApiErr;
          throw new Error(j?.message || j?.error || `HTTP ${res.status}`);
        }

        setData((json as ApiOk).data);
        setRid((json as ApiOk).rid || null);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message ?? "Kunne ikke hente innsikt."));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [range]);

  useEffect(() => {
    if (loading || err || !data) return;
    let alive = true;
    void (async () => {
      setDemandLoading(true);
      setDemandErr(null);
      try {
        const res = await fetch("/api/admin/demand-insights", { cache: "no-store" });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          data?: DemandInsightsData;
          message?: string;
        } | null;
        if (!alive) return;
        if (!res.ok || !json || json.ok !== true) {
          throw new Error(json?.message || `HTTP ${res.status}`);
        }
        setDemandData(json.data ?? null);
      } catch (e: unknown) {
        if (!alive) return;
        setDemandErr(String((e as Error)?.message ?? e));
        setDemandData(null);
      } finally {
        if (alive) setDemandLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loading, err, data]);

  const summaryRows = useMemo(() => data?.daily_summary ?? [], [data]);

  if (loading) {
    return (
      <SectionCard title="Innsikt" subtitle="Laster…">
        <div className="h-24 animate-pulse rounded-2xl bg-black/5" />
      </SectionCard>
    );
  }

  if (err) {
    return (
      <SectionCard title="Innsikt" subtitle="Kunne ikke hente data.">
        <div className="text-sm text-rose-700">{err}</div>
        {rid ? <div className="mt-2 text-xs text-neutral-500">RID: {rid}</div> : null}
      </SectionCard>
    );
  }

  if (!data) {
    return (
      <SectionCard title="Innsikt" subtitle="Ingen data tilgjengelig.">
        <div className="text-sm text-neutral-600">Ikke tilgjengelig.</div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="AI Innsikt"
        subtitle="Deterministisk etterspørselsstøtte fra ordrehistorikk — endrer ikke bestillinger eller produksjon automatisk."
      >
        {demandLoading ? <div className="h-20 animate-pulse rounded-2xl bg-black/5" /> : null}
        {demandErr && !demandLoading ? <div className="text-sm text-rose-700">{demandErr}</div> : null}
        {demandData && !demandLoading ? (
          <div className="space-y-4 text-sm text-neutral-800">
            <p className="text-xs text-neutral-600">{demandData.transparencyNote}.</p>
            <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
              <div className="text-xs font-semibold text-neutral-600">Neste virkedag (prognose)</div>
              <div className="mt-2 text-lg font-extrabold text-neutral-900">
                {fmtNum(demandData.nextBusinessDayForecast.predictedOrders)} porsjoner
              </div>
              <div className="mt-1 text-xs text-neutral-600">
                Sikkerhetsbånd ±{fmtNum(demandData.nextBusinessDayForecast.marginOfError)} · Plan med buffer ca.{" "}
                {fmtNum(demandData.nextBusinessDayForecast.plannedWithBuffer)} (+{demandData.nextBusinessDayForecast.bufferPercent.toFixed(0)} %)
              </div>
              <div className="mt-2 text-xs text-neutral-600">
                Konfidansindikator: {fmtNum(demandData.nextBusinessDayForecast.confidence * 100, 0)} % (intern).
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-700">Etterspørsel per ukedag (snitt)</div>
              <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                {demandData.weekdayRanking
                  .filter((w) => w.sampleDays > 0)
                  .sort((a, b) => b.avgActive - a.avgActive)
                  .map((w) => (
                    <li key={w.weekday}>
                      {w.label}: {fmtNum(w.avgActive, 1)} aktive (n={fmtNum(w.sampleDays)})
                    </li>
                  ))}
              </ul>
            </div>
            {demandData.dishSignals.filter((d) => d.signal !== "neutral").length > 0 ? (
              <div>
                <div className="text-xs font-semibold text-neutral-700">Menyvalg (volum)</div>
                <ul className="mt-2 space-y-1 text-xs">
                  {demandData.dishSignals
                    .filter((d) => d.signal !== "neutral")
                    .map((d) => (
                      <li key={d.choiceKey} className="text-neutral-600">
                        <span className="font-semibold text-neutral-800">{d.choiceKey}</span>: {fmtNum(d.count)}{" "}
                        {d.signal === "high" ? "— høy etterspørsel" : "— lavere volum"}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
            <div>
              <div className="text-xs font-semibold text-neutral-700">Forslag</div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-neutral-600">
                {demandData.suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-3 text-xs text-neutral-600">
              <span className="font-semibold text-neutral-800">Svinn:</span> {demandData.waste.note}
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Periode"
        subtitle={`Viser ${data.window.from} – ${data.window.to}. Tallene under viser faktisk bruk, ikke estimater.`}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRange("7d")}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold ring-1 ${
                range === "7d"
                  ? "bg-black text-white ring-black"
                  : "bg-white text-neutral-900 ring-black/10 hover:bg-white"
              }`}
            >
              7d
            </button>
            <button
              onClick={() => setRange("14d")}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold ring-1 ${
                range === "14d"
                  ? "bg-black text-white ring-black"
                  : "bg-white text-neutral-900 ring-black/10 hover:bg-white"
              }`}
            >
              14d
            </button>
            <button
              onClick={() => setRange("30d")}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold ring-1 ${
                range === "30d"
                  ? "bg-black text-white ring-black"
                  : "bg-white text-neutral-900 ring-black/10 hover:bg-white"
              }`}
            >
              30d
            </button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Kpi
            label="Totalt antall leveringer"
            value={fmtNum(data.deliveries.total_orders)}
            hint="Basert på registrerte bestillinger i perioden."
          />
          <Kpi
            label="Aktive leveringsdager"
            value={fmtNum(data.deliveries.active_days)}
            hint="Dager med registrerte bestillinger."
          />
          <Kpi
            label="Gjennomsnittlig ordre per dag"
            value={fmtNum(data.deliveries.avg_orders_per_day, 1)}
            hint="Beregnet fra aktive leveringsdager."
          />
          <Kpi
            label="Avbestillinger før cut-off"
            value={fmtNum(data.cancellations_before_cutoff.count)}
            hint="Avbestillinger før cut-off reduserer matsvinn og kost."
          />
          <Kpi
            label="Avvik etter cut-off"
            value={fmtNum(data.cancellations_after_cutoff.count)}
            hint="Registrerte endringer etter 08:00."
          />
        </div>
        {rid ? <div className="mt-3 text-xs text-neutral-500">RID: {rid}</div> : null}
        <div className="mt-3 text-xs text-neutral-600">Systemet er én sannhetskilde. Avvik logges automatisk med RID.</div>
      </SectionCard>

      <SectionCard
        title="Stabilitet og forutsigbarhet"
        subtitle="Dette gir oversikt – ikke støy."
      >
        {data.delivery_stability.available ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
              <div className="text-xs font-semibold text-neutral-600">Dager uten avvik</div>
              <div className="mt-2 text-2xl font-extrabold text-neutral-900">
                {fmtNum(data.delivery_stability.days_with_no_deviations ?? 0)}
              </div>
              <div className="mt-1 text-xs text-neutral-600">Dager med null registrerte endringer etter cut-off.</div>
            </div>
            <div className="rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5">
              <div className="text-xs font-semibold text-neutral-600">Dager med avvik</div>
              <div className="mt-2 text-2xl font-extrabold text-neutral-900">
                {fmtNum(data.delivery_stability.days_with_deviations ?? 0)}
              </div>
              <div className="mt-1 text-xs text-neutral-600">Registrerte endringer etter cut-off.</div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-neutral-600">
            {data.delivery_stability.message ?? "Ikke tilgjengelig."}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Historikk" subtitle="Siste dager i perioden."
      >
        <div className="grid gap-2">
          {summaryRows.map((row) => (
            <div key={row.date} className="rounded-2xl bg-white/70 px-4 py-3 ring-1 ring-black/5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="font-semibold text-neutral-900">{row.date}</div>
                <div className="text-neutral-700">{fmtNum(row.orders)} ordre</div>
              </div>
              <div className="mt-1 text-xs text-neutral-600">
                Før cut-off: {fmtNum(row.cancelled_before_cutoff)} · Etter cut-off: {fmtNum(row.cancelled_after_cutoff)}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

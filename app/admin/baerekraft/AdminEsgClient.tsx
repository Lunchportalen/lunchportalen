"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtCo2e, fmtKg, fmtMonthLabel, fmtNok, fmtNum } from "@/lib/esg/format";

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

type ApiOk = { ok: true; year: number; months: MonthRow[]; yearly: YearRow | null };

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

export default function AdminEsgClient() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ApiOk | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const res = await fetch("/api/admin/esg/summary", { cache: "no-store" });
        const j: any = await readJson(res);

        if (!alive) return;

        if (!j?.ok) {
          const msg = j?.message ?? j?.error ?? `Ukjent feil (HTTP ${res.status})`;
          throw new Error(String(msg));
        }

        setData(j as ApiOk);
        setErr(null);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message ?? e));
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const year = data?.yearly;

  const yearWasteRate = useMemo(() => {
    if (!year || !year.ordered_count) return null;
    return year.waste_meals / year.ordered_count;
  }, [year]);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white/60 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="h-5 w-40 animate-pulse rounded bg-black/10" />
        <div className="mt-3 h-9 w-64 animate-pulse rounded bg-black/10" />
        <div className="mt-6 h-32 animate-pulse rounded-xl bg-black/5" />
      </div>
    );
  }

  if (err) {
    return (
      <div className="rounded-2xl bg-white/60 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-bold text-rose-700">Kunne ikke hente bærekraftdata</div>
        <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{err}</div>
      </div>
    );
  }

  if (!data || (!data.yearly && (!data.months || data.months.length === 0))) {
    return (
      <div className="rounded-2xl bg-white/60 p-8 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-base font-extrabold">Ingen ESG-data ennå</div>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          Dette fylles automatisk når ESG-cron har kjørt på dager med bestillinger.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year hero */}
      <section className="rounded-2xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-[rgb(var(--lp-muted))]">År {data.year}</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight">
              Spart {fmtNok(year?.cost_saved_nok ?? 0)} · Svinn {fmtKg(year?.waste_kg ?? 0)}
            </div>
            <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
              {fmtNum(year?.ordered_count ?? 0)} bestillinger · {fmtNum(year?.cancelled_in_time_count ?? 0)} avbestilt i tide ·{" "}
              {fmtCo2e(year?.waste_co2e_kg ?? 0)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {badge(year?.stability_score ?? null)}
            <div className="text-xs text-[rgb(var(--lp-muted))]">
              Svinnrate:{" "}
              <span className="font-bold text-[rgb(var(--lp-fg))]">
                {yearWasteRate === null ? "—" : `${fmtNum(yearWasteRate * 100, 1)} %`}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Monthly list */}
      <section className="rounded-2xl bg-white/60 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="text-sm font-extrabold">Siste 12 måneder</div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Faktabasert snapshot</div>
        </div>

        <div className="divide-y divide-black/5">
          {(data.months ?? []).map((m) => {
            const wasteRate = m.ordered_count ? m.waste_meals / m.ordered_count : null;
            return (
              <div key={m.month} className="grid grid-cols-12 items-center gap-3 px-6 py-4">
                <div className="col-span-3">
                  <div className="text-sm font-bold">{fmtMonthLabel(m.month)}</div>
                  <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{fmtNum(m.ordered_count)} bestillinger</div>
                </div>

                <div className="col-span-3">
                  <div className="text-xs text-[rgb(var(--lp-muted))]">Spart</div>
                  <div className="text-sm font-extrabold">{fmtNok(m.cost_saved_nok)}</div>
                </div>

                <div className="col-span-3">
                  <div className="text-xs text-[rgb(var(--lp-muted))]">Svinn</div>
                  <div className="text-sm font-extrabold">{fmtKg(m.waste_kg)}</div>
                  <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{fmtCo2e(m.waste_co2e_kg)}</div>
                </div>

                <div className="col-span-2">
                  <div className="text-xs text-[rgb(var(--lp-muted))]">Svinnrate</div>
                  <div className="text-sm font-bold">{wasteRate === null ? "—" : `${fmtNum(wasteRate * 100, 1)} %`}</div>
                </div>

                <div className="col-span-1 flex justify-end">{badge(m.stability_score)}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { fetchKitchenList, type KitchenResp } from "@/lib/kitchen/kitchenFetch";
import {
  buildProductionHierarchy,
  mealLabel,
  slotHeading,
} from "@/lib/kitchen/buildProductionHierarchy";
import { osloTodayISODate } from "@/lib/date/oslo";

function osloPretty(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  return new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

function isISODate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default function KitchenPrintBody() {
  const sp = useSearchParams();
  const dateFromUrl = sp.get("date") ?? "";
  const dateISO = isISODate(dateFromUrl) ? dateFromUrl : osloTodayISODate();

  const [data, setData] = useState<KitchenResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void (async () => {
      const res = await fetchKitchenList(dateISO);
      if (!alive) return;
      setData(res);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [dateISO]);

  const hierarchy = useMemo(() => buildProductionHierarchy(data?.ok ? data.rows : []), [data]);

  const sourceLabel = (() => {
    if (!data?.ok) return "Kunne ikke laste produksjonsgrunnlag.";
    if (data.production_operative_snapshot?.active) {
      return "Låst produksjonsgrunnlag (materialisert operative ordre-id for datoen).";
    }
    return "Live operativ modell (ingen snapshot for dette firmaet på datoen).";
  })();

  const pretty = osloPretty(dateISO);

  return (
    <main className="mx-auto max-w-4xl bg-[rgb(var(--lp-surface))] px-4 py-8 print:max-w-none print:bg-white print:px-4 print:py-4">
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print { .no-print { display: none !important; } body { background: #fff !important; } }`,
        }}
      />
      <div className="no-print mb-6 flex flex-wrap items-center gap-2 border-b border-[rgb(var(--lp-border))] pb-4">
        <Link
          href="/kitchen"
          className="inline-flex min-h-[44px] items-center rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-slate-900"
        >
          Tilbake til kjøkken
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex min-h-[44px] items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Skriv ut
        </button>
        <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm">
          <span className="text-[rgb(var(--lp-muted))]">Dato</span>
          <input
            type="date"
            value={dateISO}
            onChange={(e) => {
              const v = e.target.value;
              if (isISODate(v)) {
                window.location.href = `/kitchen/print?date=${encodeURIComponent(v)}`;
              }
            }}
            className="bg-transparent text-slate-900 outline-none"
          />
        </label>
      </div>

      <header className="mb-6 border-b border-slate-200 pb-4 print:mb-4">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900 print:text-left">Produksjonsutskrift</h1>
        <p className="mt-2 text-center text-sm text-slate-600 print:text-left">{pretty}</p>
        <p
          className={`mt-3 text-center text-xs font-medium print:text-left ${
            data?.production_operative_snapshot?.active ? "text-emerald-900" : "text-slate-700"
          }`}
        >
          {sourceLabel}
        </p>
        {data?.production_operative_snapshot?.active && data.production_operative_snapshot.frozen_at ? (
          <p className="mt-1 text-center text-xs text-slate-500 print:text-left">
            Snapshot tidspunkt: {data.production_operative_snapshot.frozen_at}
          </p>
        ) : null}
      </header>

      {loading ? (
        <p className="text-sm text-slate-600">Laster…</p>
      ) : !data?.ok ? (
        <p className="text-sm text-red-800">{data?.detail ?? data?.reason ?? "Feil"}</p>
      ) : data.reason === "NOT_DELIVERY_DAY" ? (
        <p className="text-sm text-slate-700">Ikke leveringsdag.</p>
      ) : data.summary.orders === 0 ? (
        <p className="text-sm text-slate-700">Ingen operative linjer for valgt dato.</p>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap justify-center gap-6 text-center text-sm print:justify-start print:text-left">
            <div>
              <div className="text-xs text-slate-500">Ordrelinjer</div>
              <div className="text-xl font-semibold tabular-nums text-slate-900">{data.summary.orders}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Firma</div>
              <div className="text-xl font-semibold tabular-nums text-slate-900">{data.summary.companies}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Personer</div>
              <div className="text-xl font-semibold tabular-nums text-slate-900">{data.summary.people}</div>
            </div>
          </div>

          <div className="space-y-6 print:space-y-4">
            {hierarchy.map((sl) => (
              <section key={sl.slot} className="break-inside-avoid rounded-xl border border-slate-200 bg-white print:border-slate-300">
                <h2 className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-900 print:bg-slate-100">
                  {slotHeading(sl.slot)}
                </h2>
                {sl.companies.map((co) => (
                  <div key={`${sl.slot}-${co.company}`} className="border-t border-slate-100 first:border-t-0">
                    <h3 className="bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-800">{co.company}</h3>
                    {co.locations.map((loc) => (
                      <div key={`${sl.slot}-${co.company}-${loc.location}`} className="border-t border-slate-100">
                        <div className="px-4 py-1 text-xs font-semibold text-slate-600">{loc.location}</div>
                        <ul className="divide-y divide-slate-100 px-2 pb-2">
                          {loc.rows.map((r) => (
                            <li key={r.orderId} className="flex flex-col gap-0.5 px-2 py-2 text-sm text-slate-900 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                              <div className="min-w-0 font-medium">
                                {r.employeeName}
                                {r.department ? (
                                  <span className="ml-1 font-normal text-slate-600">· {r.department}</span>
                                ) : null}
                              </div>
                              <div className="min-w-0 shrink-0 text-right text-slate-800 sm:max-w-[55%]">
                                <div>{mealLabel(r)}</div>
                                {r.note ? <div className="mt-0.5 text-xs text-slate-600">Notat: {r.note}</div> : null}
                                {Array.isArray(r.menu_allergens) && r.menu_allergens.length ? (
                                  <div className="mt-0.5 text-xs text-slate-600">Allergener: {r.menu_allergens.join(", ")}</div>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                        <div className="border-t border-dashed border-slate-200 px-4 py-1 text-right text-xs text-slate-600">
                          Antall: {loc.rows.length}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

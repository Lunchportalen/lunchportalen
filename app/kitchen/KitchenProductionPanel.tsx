"use client";

import React, { useEffect, useMemo, useState } from "react";

import { fetchKitchenList, type KitchenResp, type KitchenRow } from "@/lib/kitchen/kitchenFetch";
import {
  buildProductionHierarchy,
  mealLabel,
  rowSlot,
  slotHeading,
} from "@/lib/kitchen/buildProductionHierarchy";
import { osloTodayISODate } from "@/lib/date/oslo";
import Link from "next/link";

function osloISO(d: Date) {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

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

function isWeekendISO(dateISO: string) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

function addDaysISO(dateISO: string, days: number) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  d.setDate(d.getDate() + days);
  return osloISO(d);
}

function nextBusinessDayISO(dateISO: string) {
  let cur = addDaysISO(dateISO, 1);
  while (isWeekendISO(cur)) cur = addDaysISO(cur, 1);
  return cur;
}

function chipClass(kind: "ok" | "warn" | "crit") {
  if (kind === "crit") return "bg-red-50 border-red-200 text-red-900";
  if (kind === "warn") return "bg-yellow-50 border-yellow-200 text-yellow-900";
  return "bg-emerald-50 border-emerald-200 text-emerald-900";
}

async function findNextActiveDate(startISO: string) {
  let cur = startISO;
  for (let i = 0; i < 14; i++) {
    if (isWeekendISO(cur)) {
      cur = nextBusinessDayISO(cur);
      continue;
    }
    const res = await fetchKitchenList(cur);
    if (res.ok && (res.summary?.orders ?? 0) > 0) return { date: cur, res };
    cur = nextBusinessDayISO(cur);
  }
  const res = await fetchKitchenList(startISO);
  return { date: startISO, res };
}

function EmptyState({
  reason,
  onNextActive,
}: {
  reason?: KitchenResp["reason"];
  onNextActive: () => void;
}) {
  const text = (() => {
    switch (reason) {
      case "NOT_DELIVERY_DAY":
        return "Dette er ikke en leveringsdag (man–fre).";
      case "COMPANIES_PAUSED":
        return "Ingen aktive firma/avtaler denne dagen.";
      case "AUTH_REQUIRED":
        return "Du må være innlogget for å se kjøkkenvisning.";
      case "ERROR":
        return "Kunne ikke hente data. Sjekk API/tilkobling.";
      case "NO_ORDERS":
      default:
        return "Ingen bestillinger denne dagen.";
    }
  })();

  return (
    <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 shadow-[var(--lp-shadow-soft)]">
      <div className="text-sm text-slate-700">{text}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={onNextActive}
          className="min-h-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-semibold text-slate-900"
          type="button"
        >
          Gå til neste leveringsdag
        </button>
      </div>
    </div>
  );
}

export type KitchenProductionPanelProps = {
  /** Dato styres av forelder (én sannhet for hele kjøkkenflaten). */
  dateISO: string;
  onDateISOChange: (iso: string) => void;
};

export default function KitchenProductionPanel({ dateISO, onDateISOChange }: KitchenProductionPanelProps) {
  const todayISO = useMemo(() => osloTodayISODate(), []);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<KitchenResp | null>(null);
  const [autoPicked, setAutoPicked] = useState(false);

  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterMeal, setFilterMeal] = useState<string>("all");

  async function load(d: string) {
    setLoading(true);
    try {
      const res = await fetchKitchenList(d);
      setData(res);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const first = await fetchKitchenList(todayISO);
        if (!alive) return;
        const isHardError = !first.ok && (first.reason === "AUTH_REQUIRED" || first.reason === "ERROR");
        if (!isHardError && (first.summary?.orders ?? 0) === 0 && !autoPicked) {
          const next = await findNextActiveDate(todayISO);
          if (!alive) return;
          setAutoPicked(true);
          onDateISOChange(next.date);
          setData(next.res);
        } else {
          onDateISOChange(todayISO);
          setData(first);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kun ved mount
  }, []);

  useEffect(() => {
    if (!data) return;
    if (data.date !== dateISO) void load(dateISO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  const summary = data?.summary ?? { orders: 0, companies: 0, people: 0 };

  const rows = useMemo(() => (Array.isArray(data?.rows) ? data!.rows : []), [data]);

  const companyOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(r.company);
    return Array.from(s).sort((a, b) => a.localeCompare(b, "nb"));
  }, [rows]);

  const locationOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (filterCompany === "all" || r.company === filterCompany) s.add(r.location);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "nb"));
  }, [rows, filterCompany]);

  const mealOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (filterCompany !== "all" && r.company !== filterCompany) continue;
      if (filterLocation !== "all" && r.location !== filterLocation) continue;
      s.add(mealLabel(r));
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "nb"));
  }, [rows, filterCompany, filterLocation]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterCompany !== "all" && r.company !== filterCompany) return false;
      if (filterLocation !== "all" && r.location !== filterLocation) return false;
      if (filterMeal !== "all" && mealLabel(r) !== filterMeal) return false;
      return true;
    });
  }, [rows, filterCompany, filterLocation, filterMeal]);

  const countsByCompany = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredRows) m.set(r.company, (m.get(r.company) ?? 0) + 1);
    return m;
  }, [filteredRows]);

  const countsByLocation = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredRows) m.set(r.location, (m.get(r.location) ?? 0) + 1);
    return m;
  }, [filteredRows]);

  const countsByMeal = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredRows) {
      const k = mealLabel(r);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [filteredRows]);

  const countsBySlot = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredRows) {
      const k = rowSlot(r);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [filteredRows]);

  const uniqueSlotCount = useMemo(() => countsBySlot.size, [countsBySlot]);

  const status = (() => {
    if (!data) return { kind: "warn" as const, label: "Laster…" };
    if (!data.ok) return { kind: "crit" as const, label: "Problem" };
    if ((summary.orders ?? 0) === 0) return { kind: "warn" as const, label: "Tom dag" };
    return { kind: "ok" as const, label: "Klar" };
  })();

  const cutoffLabel = (() => {
    if (!data?.cutoff) return null;
    return data.cutoff.isAfterCutoff
      ? `Stengt (etter ${data.cutoff.cutoffTime})`
      : `Åpen (til ${data.cutoff.cutoffTime})`;
  })();

  function setPrevDay() {
    setAutoPicked(true);
    onDateISOChange(addDaysISO(dateISO, -1));
  }
  function setNextDay() {
    setAutoPicked(true);
    onDateISOChange(addDaysISO(dateISO, 1));
  }
  function setTomorrow() {
    setAutoPicked(true);
    onDateISOChange(addDaysISO(todayISO, 1));
  }
  function setNextDelivery() {
    setAutoPicked(true);
    onDateISOChange(nextBusinessDayISO(todayISO));
  }
  async function goNextActive() {
    setLoading(true);
    try {
      const next = await findNextActiveDate(dateISO);
      setAutoPicked(true);
      onDateISOChange(next.date);
      setData(next.res);
    } finally {
      setLoading(false);
    }
  }

  const productionHierarchy = useMemo(() => buildProductionHierarchy(filteredRows), [filteredRows]);

  const pretty = osloPretty(dateISO);

  return (
    <section className="w-full space-y-4" aria-label="Produksjonsliste">
      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={setPrevDay}
              className="min-h-[44px] min-w-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] px-3 py-2 text-sm"
              type="button"
              title="Forrige dag"
            >
              ◀
            </button>
            <div className="min-w-0 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-center text-sm font-semibold text-slate-900">
              {pretty}
            </div>
            <button
              onClick={setNextDay}
              className="min-h-[44px] min-w-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] px-3 py-2 text-sm"
              type="button"
              title="Neste dag"
            >
              ▶
            </button>
            <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm">
              <span className="text-[rgb(var(--lp-muted))]">Dato</span>
              <input
                type="date"
                value={dateISO}
                onChange={(e) => {
                  setAutoPicked(true);
                  onDateISOChange(e.target.value);
                }}
                className="min-w-0 bg-transparent text-slate-900 outline-none"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${chipClass(status.kind)}`}>
              {status.label}
            </span>
            {cutoffLabel ? (
              <span className="inline-flex items-center rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] px-3 py-1 text-xs text-slate-700">
                {cutoffLabel}
              </span>
            ) : null}
            {loading ? <span className="text-xs text-[rgb(var(--lp-muted))]">Henter…</span> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setAutoPicked(true);
              onDateISOChange(todayISO);
            }}
            className="min-h-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-slate-900"
          >
            I dag
          </button>
          <button type="button" onClick={setTomorrow} className="min-h-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-slate-900">
            I morgen
          </button>
          <button type="button" onClick={setNextDelivery} className="min-h-[44px] rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-slate-900">
            Neste leveringsdag
          </button>
          <button type="button" onClick={goNextActive} className="min-h-[44px] rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Finn aktive bestillinger
          </button>
          <Link
            href={`/kitchen/print?date=${encodeURIComponent(dateISO)}`}
            className="inline-flex min-h-[44px] items-center rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-medium text-slate-900 print:hidden"
          >
            Produksjonsutskrift
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-4 text-center">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Totalt (filtrert)</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{filteredRows.length}</div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">porsjoner</div>
          </div>
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-4 text-center">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Leveringsvinduer</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{uniqueSlotCount}</div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">unike slot</div>
          </div>
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-4 text-center">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Firma (unike)</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{countsByCompany.size}</div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">i utvalg</div>
          </div>
          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-4 text-center">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Lokasjoner (unike)</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{countsByLocation.size}</div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">i utvalg</div>
          </div>
        </div>
      </div>

      {/* Fordeling per firma / lokasjon / måltid — kompakt, skannbar */}
      {filteredRows.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Per leveringsvindu</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {Array.from(countsBySlot.entries())
                .sort((a, b) => a[0].localeCompare(b[0], "nb"))
                .map(([name, n]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{slotHeading(name)}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </li>
                ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Per firma</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {Array.from(countsByCompany.entries())
                .sort((a, b) => a[0].localeCompare(b[0], "nb"))
                .map(([name, n]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{name}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </li>
                ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Per lokasjon</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {Array.from(countsByLocation.entries())
                .sort((a, b) => a[0].localeCompare(b[0], "nb"))
                .map(([name, n]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{name}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </li>
                ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">Per meny / måltid</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {Array.from(countsByMeal.entries())
                .sort((a, b) => a[0].localeCompare(b[0], "nb"))
                .map(([name, n]) => (
                  <li key={name} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{name}</span>
                    <span className="font-semibold tabular-nums">{n}</span>
                  </li>
                ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <label className="flex min-w-[140px] flex-col gap-1 text-sm font-semibold text-slate-900">
            Firma
            <select
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
              value={filterCompany}
              onChange={(e) => {
                setFilterCompany(e.target.value);
                setFilterLocation("all");
                setFilterMeal("all");
              }}
            >
              <option value="all">Alle</option>
              {companyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[140px] flex-col gap-1 text-sm font-semibold text-slate-900">
            Lokasjon
            <select
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
              value={filterLocation}
              onChange={(e) => {
                setFilterLocation(e.target.value);
                setFilterMeal("all");
              }}
            >
              <option value="all">Alle</option>
              {locationOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[140px] flex-col gap-1 text-sm font-semibold text-slate-900">
            Meny / måltid
            <select
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
              value={filterMeal}
              onChange={(e) => setFilterMeal(e.target.value)}
            >
              <option value="all">Alle</option>
              {mealOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!data || loading ? (
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5 text-sm text-slate-600 shadow-[var(--lp-shadow-soft)]">
          Laster produksjonsliste…
        </div>
      ) : !data.ok || summary.orders === 0 ? (
        <EmptyState reason={data.reason ?? "NO_ORDERS"} onNextActive={goNextActive} />
      ) : (
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white shadow-[var(--lp-shadow-soft)]">
          <div className="border-b border-[rgb(var(--lp-divider))] p-4 text-sm font-semibold text-slate-900">
            Linjer (ordre) — gruppert: leveringsvindu → firma → lokasjon → ansatt
          </div>

          <div className="divide-y divide-[rgb(var(--lp-divider))]">
            {productionHierarchy.map((sl) => (
              <div key={sl.slot} className="bg-white">
                <div className="bg-slate-100 px-4 py-2 text-sm font-extrabold text-slate-900">{slotHeading(sl.slot)}</div>
                {sl.companies.map((co) => (
                  <div key={`${sl.slot}-${co.company}`} className="border-t border-[rgb(var(--lp-divider))] first:border-t-0">
                    <div className="bg-[rgb(var(--lp-surface-2))] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-800">{co.company}</div>
                    {co.locations.map((loc) => (
                      <div key={`${sl.slot}-${co.company}-${loc.location}`}>
                        <div className="border-t border-[rgb(var(--lp-divider))] bg-white px-4 py-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
                          {loc.location}
                        </div>
                        <div className="divide-y divide-[rgb(var(--lp-divider))]">
                          {loc.rows.map((row) => (
                            <div key={row.orderId || `${sl.slot}-${row.employeeName}`} className="p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-slate-900">
                                  {row.employeeName}
                                  {row.department ? (
                                    <span className="ml-2 text-xs font-normal text-[rgb(var(--lp-muted))]">• {row.department}</span>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] px-3 py-1 text-xs text-slate-700">
                                    {row.orderStatus}
                                  </span>
                                  {row.tier ? (
                                    <span className="rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] px-3 py-1 text-xs text-slate-700">
                                      {row.tier === "BASIS" ? "Basis" : "Luxus"}
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              {row.menu_title || row.menu_description || (row.menu_allergens && row.menu_allergens.length) ? (
                                <div className="mt-2 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-3 text-sm text-slate-800">
                                  {row.menu_title ? <div className="font-semibold">{row.menu_title}</div> : null}
                                  {row.menu_description ? <div className="mt-1 opacity-90">{row.menu_description}</div> : null}
                                  {row.menu_allergens && row.menu_allergens.length ? (
                                    <div className="mt-1 text-xs opacity-80">Allergener: {row.menu_allergens.join(", ")}</div>
                                  ) : null}
                                </div>
                              ) : null}
                              {row.note ? (
                                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                                  <span className="font-medium">Notat (ordre):</span> {row.note}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

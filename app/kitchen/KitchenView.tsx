"use client";

import React from "react";

type Mode = "day" | "week";

type Totals = {
  basis: number;
  luxus: number;
  total: number;
};

type Employee = {
  user_id: string;
  name: string;
  department: string | null;
  note: string | null;
};

type LocationGroup = {
  location_id: string;
  location_name: string;
  employees: Employee[];
};

type CompanyGroup = {
  company_id: string;
  company_name: string;
  locations: LocationGroup[];
};

type SlotGroup = {
  slot: string;
  totals: Totals;
  companies: CompanyGroup[];
};

type DayGroup = {
  date: string;
  totals: Totals;
  slots: SlotGroup[];
};

type Report = {
  mode: Mode;
  date: string;
  period: { weekStart: string; weekEnd: string };
  totals: Totals;
  days: DayGroup[];
  excluded: Array<{
    order_id: string;
    company_id: string;
    location_id: string;
    date: string;
    reason: "MISSING_ACTIVE_AGREEMENT" | "INVALID_TIER";
  }>;
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function mondayIso(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const diff = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function apiMessage(error: any): string {
  const detail = safeStr(error?.message || error?.error);
  return detail || "Kunne ikke hente kjøkkenrapport.";
}

export default function KitchenView() {
  const defaultDate = React.useMemo(() => todayIso(), []);
  const [mode, setMode] = React.useState<Mode>("day");
  const [date, setDate] = React.useState<string>(defaultDate);
  const [weekStart, setWeekStart] = React.useState<string>(mondayIso(defaultDate));

  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<Report | null>(null);

  const csvHref = React.useMemo(() => {
    const params = new URLSearchParams({ mode });
    if (mode === "day") params.set("date", date);
    if (mode === "week") params.set("weekStart", weekStart);
    return `/api/kitchen/report.csv?${params.toString()}`;
  }, [mode, date, weekStart]);

  const load = React.useCallback(async () => {
    if (mode === "day" && !isIsoDate(date)) {
      setError("Dato må være YYYY-MM-DD.");
      setReport(null);
      setLoading(false);
      return;
    }

    if (mode === "week" && !isIsoDate(weekStart)) {
      setError("Uke-start må være YYYY-MM-DD.");
      setReport(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ mode });
      if (mode === "day") params.set("date", date);
      if (mode === "week") params.set("weekStart", weekStart);

      const response = await fetch(`/api/kitchen/report?${params.toString()}`, {
        cache: "no-store",
        headers: { accept: "application/json" },
      });

      const body = await response.json().catch(() => null);
      if (!response.ok || !body || body.ok !== true) {
        throw body || { message: `HTTP ${response.status}` };
      }

      const data = body.data as Report;
      setReport(data);
    } catch (err: any) {
      setError(apiMessage(err));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [mode, date, weekStart]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="w-full">
      <div className="print:hidden rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-900">
            Visning
            <select
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
              value={mode}
              onChange={(event) => setMode(event.target.value === "week" ? "week" : "day")}
            >
              <option value="day">Dag</option>
              <option value="week">Uke</option>
            </select>
          </label>

          {mode === "day" ? (
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-900">
              Dato
              <input
                className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-900">
              Uke-start (mandag)
              <input
                className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm"
                type="date"
                value={weekStart}
                onChange={(event) => setWeekStart(event.target.value)}
              />
            </label>
          )}

          <div className="ml-auto flex flex-wrap items-end gap-2">
            <button
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold"
              onClick={() => void load()}
              type="button"
            >
              Oppdater
            </button>
            <a
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold"
              href={csvHref}
            >
              Last ned CSV
            </a>
            <button
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold"
              onClick={() => window.print()}
              type="button"
            >
              Skriv ut
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
          Laster kjøkkenrapport ...
        </div>
      ) : null}

      {error && !loading ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
          {error}
        </div>
      ) : null}

      {report && !loading ? (
        <>
          <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
            <h2 className="text-lg font-extrabold text-slate-900">Oppsummering</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <span className="rounded-xl bg-[rgb(var(--lp-surface-2))] px-3 py-2">Basis: {report.totals.basis}</span>
              <span className="rounded-xl bg-[rgb(var(--lp-surface-2))] px-3 py-2">Luxus: {report.totals.luxus}</span>
              <span className="rounded-xl bg-[rgb(var(--lp-surface-2))] px-3 py-2">Totalt: {report.totals.total}</span>
            </div>
            {report.mode === "week" ? (
              <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
                Uke {report.period.weekStart} til {report.period.weekEnd}
              </p>
            ) : null}
          </div>

          {report.excluded.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {report.excluded.length} bestillinger manglet aktiv avtale og er ikke med i listen.
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            {report.days.map((day) => (
              <article key={day.date} className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
                <header className="border-b border-[rgb(var(--lp-divider))] pb-2">
                  <h3 className="text-base font-extrabold text-slate-900">{day.date}</h3>
                  <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
                    Basis {day.totals.basis} - Luxus {day.totals.luxus} - Totalt {day.totals.total}
                  </p>
                </header>

                <div className="mt-3 space-y-3">
                  {day.slots.map((slot) => (
                    <section key={`${day.date}:${slot.slot}`} className="rounded-2xl border border-[rgb(var(--lp-border))] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-sm font-extrabold text-slate-900">{slot.slot}</h4>
                        <div className="text-xs text-[rgb(var(--lp-muted))]">
                          Basis {slot.totals.basis} - Luxus {slot.totals.luxus} - Totalt {slot.totals.total}
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        {slot.companies.map((company) => (
                          <div key={`${slot.slot}:${company.company_id}`} className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-3">
                            <h5 className="text-sm font-semibold text-slate-900">{company.company_name}</h5>

                            <div className="mt-2 space-y-2">
                              {company.locations.map((location) => (
                                <div key={`${company.company_id}:${location.location_id}`} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
                                  <div className="text-xs font-semibold text-slate-900">{location.location_name}</div>
                                  <ul className="mt-2 space-y-2">
                                    {location.employees.map((employee) => (
                                      <li key={`${location.location_id}:${employee.user_id}`} className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] px-3 py-2 text-sm">
                                        <div className="font-semibold text-slate-900">{employee.name}</div>
                                        {employee.department ? (
                                          <div className="text-xs text-[rgb(var(--lp-muted))]">{employee.department}</div>
                                        ) : null}
                                        {employee.note ? (
                                          <div className="mt-1 text-xs text-slate-700">{employee.note}</div>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}


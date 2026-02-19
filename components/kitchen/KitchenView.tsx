// components/kitchen/KitchenView.tsx
"use client";

import React from "react";

type Mode = "day" | "week";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isIsoDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function todayISO() {
  // client fallback – server er fasit, men vi trenger en default
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

type KitchenReport = {
  ok: true;
  rid: string;
  mode: Mode;
  date: string;
  dates: string[];
  cutoff: {
    time: "08:00";
    locked: boolean;
    lockedReason: "PAST_DATE" | "CUTOFF_PASSED_TODAY" | "NOT_LOCKED";
    osloToday: string;
    osloNowHHMM: string;
  };
  export: { exportId: string; stableHash: string };
  grandTotals: { basis: number; luxus: number; total: number };
  companies: Array<{
    companyId: string;
    companyName: string;
    totals: { basis: number; luxus: number; total: number };
    locations: Array<{
      locationId: string;
      locationName: string;
      address: string;
      windowFrom?: string | null;
      windowTo?: string | null;
      windowLabel?: string | null;
      totals: { basis: number; luxus: number; total: number };
      notes?: string | null;
      choices: Array<{
        key: string;
        label: string;
        total: number;
        variants?: Array<{ name: string; count: number }>;
      }>;
      flags: string[];
    }>;
  }>;
};

type ApiOk = { ok: true; data: KitchenReport };
type ApiErr = { ok: false; error?: { message?: string } };

async function fetchReport(date: string, mode: Mode) {
  const qs = new URLSearchParams({ date, mode });
  const res = await fetch(`/api/kitchen/report?${qs.toString()}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });

  const payload = (await res.json().catch(() => null)) as ApiOk | ApiErr | null;

  if (!res.ok) {
    const msg = (payload as any)?.error?.message || "Kunne ikke hente kjøkkenrapport.";
    throw new Error(msg);
  }

  if (!payload || (payload as any).ok !== true || !(payload as any).data) {
    throw new Error("Ugyldig API-respons (fail-closed).");
  }

  return (payload as ApiOk).data;
}

export default function KitchenView(props: { initialDate?: string; initialMode?: Mode }) {
  const [mode, setMode] = React.useState<Mode>(props.initialMode ?? "day");
  const [date, setDate] = React.useState<string>(
    isIsoDate(props.initialDate ?? "") ? (props.initialDate as string) : todayISO()
  );

  const [state, setState] = React.useState<{
    loading: boolean;
    error: string | null;
    report: KitchenReport | null;
  }>({ loading: true, error: null, report: null });

  const load = React.useCallback(async () => {
    const d = safeStr(date);
    if (!isIsoDate(d)) {
      setState({ loading: false, error: "Ugyldig dato (må være YYYY-MM-DD).", report: null });
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const rep = await fetchReport(d, mode);
      setState({ loading: false, error: null, report: rep });
    } catch (e: any) {
      setState({ loading: false, error: String(e?.message ?? e), report: null });
    }
  }, [date, mode]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const report = state.report;

  const csvHref = report
    ? `/api/kitchen/report?${new URLSearchParams({ date: report.date, mode: report.mode, format: "csv" }).toString()}`
    : `/api/kitchen/report?${new URLSearchParams({ date, mode, format: "csv" }).toString()}`;

  return (
    <div className="lp-container py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <div className="text-xl font-semibold">Kjøkkenrapport</div>
          <div className="text-sm text-[rgb(var(--lp-muted))]">
            Server-fasit • Deterministisk grouping • CSV-eksport • Print-vennlig
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm shadow-[var(--lp-shadow-soft)]"
            value={mode}
            onChange={(e) => setMode((e.target.value as Mode) || "day")}
          >
            <option value="day">Dag</option>
            <option value="week">Uke (Man–Fre)</option>
          </select>

          <input
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm shadow-[var(--lp-shadow-soft)]"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <button
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm shadow-[var(--lp-shadow-soft)] hover:shadow-[var(--lp-shadow-1)]"
            onClick={() => void load()}
          >
            Oppdater
          </button>

          <a
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm shadow-[var(--lp-shadow-soft)] hover:shadow-[var(--lp-shadow-1)]"
            href={csvHref}
          >
            Last ned CSV
          </a>

          <button
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm shadow-[var(--lp-shadow-soft)] hover:shadow-[var(--lp-shadow-1)]"
            onClick={() => window.print()}
            disabled={!report}
          >
            Skriv ut
          </button>
        </div>
      </div>

      {/* STATUS / FAIL-CLOSED */}
      {state.loading ? (
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
          Laster…
        </div>
      ) : state.error ? (
        <div className="rounded-2xl border border-red-200 bg-white p-4 text-red-700 shadow-[var(--lp-shadow-soft)]">
          {state.error}
        </div>
      ) : !report ? (
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
          Ingen data.
        </div>
      ) : (
        <>
          {/* CUT-OFF */}
          <div className="mb-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm">
                <span className="font-semibold">Dato:</span> {report.date}{" "}
                <span className="text-[rgb(var(--lp-muted))]">({report.mode === "week" ? "uke" : "dag"})</span>
              </div>

              <div className="text-sm text-[rgb(var(--lp-muted))]">
                <span className="font-semibold">Cut-off:</span> {report.cutoff.time} • Oslo nå {report.cutoff.osloNowHHMM} •
                Oslo i dag {report.cutoff.osloToday}
              </div>

              <div
                className={cx(
                  "ml-auto rounded-full px-3 py-1 text-xs font-semibold",
                  report.cutoff.locked ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                )}
              >
                {report.cutoff.locked ? "LÅST" : "ÅPEN"} ({report.cutoff.lockedReason})
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <div className="rounded-xl bg-[rgb(var(--lp-surface-2))] px-3 py-2">
                <span className="font-semibold">Basis:</span> {report.grandTotals.basis}
              </div>
              <div className="rounded-xl bg-[rgb(var(--lp-surface-2))] px-3 py-2">
                <span className="font-semibold">Luxus:</span> {report.grandTotals.luxus}
              </div>
              <div className="rounded-xl bg-[rgb(var(--lp-surface-2))] px-3 py-2">
                <span className="font-semibold">Totalt:</span> {report.grandTotals.total}
              </div>
              <div className="rounded-xl bg-[rgb(var(--lp-surface-2))] px-3 py-2 text-[rgb(var(--lp-muted))]">
                ExportId: <span className="font-mono text-xs">{report.export.exportId.slice(0, 18)}…</span>
              </div>
            </div>
          </div>

          {/* REPORT */}
          <div className="space-y-4">
            {report.companies.map((c) => (
              <div key={c.companyId} className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-[var(--lp-shadow-soft)]">
                <div className="flex flex-wrap items-baseline gap-2">
                  <div className="text-base font-semibold">{c.companyName}</div>
                  <div className="text-sm text-[rgb(var(--lp-muted))]">
                    Basis {c.totals.basis} • Luxus {c.totals.luxus} • Totalt {c.totals.total}
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {c.locations.map((l) => (
                    <div key={l.locationId} className="rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{l.locationName}</div>
                          <div className="text-xs text-[rgb(var(--lp-muted))]">
                            {l.address ? l.address : "—"} {l.windowLabel ? `• Vindu ${l.windowLabel}` : ""}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-white px-3 py-1">
                            Basis <span className="font-semibold">{l.totals.basis}</span>
                          </span>
                          <span className="rounded-full bg-white px-3 py-1">
                            Luxus <span className="font-semibold">{l.totals.luxus}</span>
                          </span>
                          <span className="rounded-full bg-white px-3 py-1">
                            Totalt <span className="font-semibold">{l.totals.total}</span>
                          </span>
                        </div>
                      </div>

                      {l.flags?.length ? (
                        <div className="mt-2 text-xs text-red-700">
                          <span className="font-semibold">Flags:</span> {l.flags.join(", ")}
                        </div>
                      ) : null}

                      {l.notes ? (
                        <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
                          <span className="font-semibold">Notat:</span> {l.notes}
                        </div>
                      ) : null}

                      <div className="mt-3">
                        <div className="text-xs font-semibold">Ønsker (valg)</div>
                        {l.choices?.length ? (
                          <div className="mt-2 grid gap-2 md:grid-cols-2">
                            {l.choices.map((ch) => (
                              <div key={ch.key} className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm font-semibold">{ch.label}</div>
                                  <div className="text-sm">{ch.total}</div>
                                </div>

                                {ch.variants?.length ? (
                                  <div className="mt-2 space-y-1 text-xs text-[rgb(var(--lp-muted))]">
                                    {ch.variants.map((v) => (
                                      <div key={v.name} className="flex items-center justify-between gap-2">
                                        <span className="truncate">{v.name}</span>
                                        <span className="font-semibold">{v.count}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Ingen valg registrert.</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Print helper (hidden on screen, visible in print) */}
          <div className="mt-6 hidden print:block">
            <div className="text-xs">
              ExportId: <span className="font-mono">{report.export.exportId}</span> • Hash{" "}
              <span className="font-mono">{report.export.stableHash}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

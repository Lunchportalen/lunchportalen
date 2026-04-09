// app/kitchen/report/KitchenReportClient.tsx
/** @deprecated Routen `/kitchen/report` redirecter til `/kitchen?tab=aggregate`. Beholdes midlertidig for referanse. */
"use client";

import React, { useEffect, useMemo, useState } from "react";

import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";

type Mode = "day" | "week";
type Totals = { basis: number; luxus: number; total: number };

type ChoiceBreakdown = {
  key: string;
  label: string;
  total: number;
  variants?: { name: string; count: number }[];
};

type LocationOut = {
  locationId: string;
  locationName: string;
  address: string;

  windowFrom?: string | null;
  windowTo?: string | null;
  windowLabel?: string | null;

  totals: Totals;
  notes?: string | null;

  // ✅ what customers want
  choices: ChoiceBreakdown[];

  flags: string[];
};

type CompanyOut = {
  companyId: string;
  companyName: string;
  totals: Totals;
  locations: LocationOut[];
};

type ReportOk = {
  ok: true;
  rid: string;
  mode: Mode;
  date: string; // YYYY-MM-DD (anchor)
  dates: string[];
  companies: CompanyOut[];
  grandTotals: Totals;
};

type ReportErr = { ok: false; rid?: string; error?: string; message?: string; detail?: any };

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function todayISOClient() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function flagLabel(f: string) {
  switch (f) {
    case "missing_location_id":
      return "Mangler lokasjon";
    case "unknown_location":
      return "Ukjent lokasjon";
    case "missing_delivery_window":
      return "Mangler leveringsvindu";
    case "unknown_tier":
      return "Ukjent nivå (Basis/Luxus)";
    case "missing_choice":
      return "Mangler menyvalg (day_choices)";
    case "missing_variant":
      return `Mangler variant (${displayLabelForMealTypeKey("salatbar", null)}/${displayLabelForMealTypeKey("paasmurt", null)})`;
    default:
      return f;
  }
}

function fmtWindow(loc: LocationOut) {
  const w = safeStr(loc.windowLabel);
  if (w) return w;
  const f = safeStr(loc.windowFrom);
  const t = safeStr(loc.windowTo);
  if (f && t) return `${f}–${t}`;
  if (f) return f;
  if (t) return t;
  return "";
}

export default function KitchenReportClient() {
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState<string>(todayISOClient());

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportOk | null>(null);
  const [err, setErr] = useState<ReportErr | null>(null);

  const apiUrl = useMemo(() => {
    const u = new URL("/api/kitchen/report", window.location.origin);
    u.searchParams.set("mode", mode);
    if (safeStr(date)) u.searchParams.set("date", date);
    return u.toString();
  }, [mode, date]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);

    fetch(apiUrl, { method: "GET", headers: { "cache-control": "no-store" } })
      .then(async (r) => {
        const j = await r.json();
        return j as ReportOk | ReportErr;
      })
      .then((j) => {
        if (!alive) return;
        if ((j as any)?.ok) setData(j as ReportOk);
        else setErr(j as ReportErr);
      })
      .catch((e) => {
        if (!alive) return;
        setErr({ ok: false, error: "fetch_failed", message: safeStr(e?.message || e) });
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [apiUrl]);

  return (
    <main className="lp-kitchen-report">
      <header className="lp-card lp-toolbar no-print">
        <div className="lp-row">
          <div>
            <h1 className="lp-h1">Kjøkkenrapport</h1>
            <div className="lp-muted">Read-only · firma → lokasjon · totaler + kundebehov · utskriftsklar</div>
          </div>

          <div className="lp-row items-end">
            <label className="lp-field">
              <span className="lp-label">Modus</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="day">Dag</option>
                <option value="week">Uke (Man–Fre)</option>
              </select>
            </label>

            <label className="lp-field">
              <span className="lp-label">Dato (anker)</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>

            <button className="lp-btn" onClick={() => window.print()}>
              Skriv ut
            </button>
          </div>
        </div>
      </header>

      {loading && (
        <section className="lp-card">
          <div className="lp-muted">Henter rapport…</div>
        </section>
      )}

      {err && !loading && (
        <section className="lp-card">
          <h2 className="lp-h2">Kunne ikke hente rapport</h2>
          <p className="lp-muted">
            {safeStr(err.message) || "Ukjent feil."} {err.error ? `(${err.error})` : ""}
          </p>
        </section>
      )}

      {data && !loading && (
        <>
          <section className="lp-card">
            <div className="lp-row">
              <div>
                <div className="lp-kicker">{data.mode === "week" ? "Uke" : "Dag"}</div>
                <div className="text-lg font-semibold">
                  {data.mode === "week"
                    ? `${data.dates[0]} → ${data.dates[data.dates.length - 1]}`
                    : data.date}
                </div>
                <div className="lp-muted">RID: {data.rid}</div>
              </div>

              <div className="lp-totals">
                <div className="lp-totalBox">
                  <div className="lp-label">Basis</div>
                  <div className="lp-num">{data.grandTotals.basis}</div>
                </div>
                <div className="lp-totalBox">
                  <div className="lp-label">Luxus</div>
                  <div className="lp-num">{data.grandTotals.luxus}</div>
                </div>
                <div className="lp-totalBox">
                  <div className="lp-label">Totalt</div>
                  <div className="lp-num">{data.grandTotals.total}</div>
                </div>
              </div>
            </div>
          </section>

          {data.companies.map((c, idx) => (
            <section key={c.companyId} className={`lp-card ${idx === 0 ? "" : "page-break"}`}>
              <div className="lp-companyHead">
                <div>
                  <h2 className="lp-h2">{c.companyName}</h2>
                  <div className="lp-muted">
                    Sum: Basis {c.totals.basis} · Luxus {c.totals.luxus} · Totalt {c.totals.total}
                  </div>
                </div>

                <div className="lp-badges">
                  <div className="lp-badge">Basis: {c.totals.basis}</div>
                  <div className="lp-badge">Luxus: {c.totals.luxus}</div>
                  <div className="lp-badge">Totalt: {c.totals.total}</div>
                </div>
              </div>

              <div className="lp-locations">
                {c.locations.map((loc) => {
                  const w = fmtWindow(loc);
                  return (
                    <div key={`${c.companyId}:${loc.locationId}`} className="lp-location">
                      <div className="lp-locationTop">
                        <div className="lp-locationMeta">
                          <div className="font-semibold">{loc.locationName}</div>
                          {safeStr(loc.address) ? (
                            <div className="lp-muted">{loc.address}</div>
                          ) : (
                            <div className="lp-muted">Adresse: (mangler)</div>
                          )}
                          {w ? <div className="lp-muted">Vindu: {w}</div> : <div className="lp-muted">Vindu: (mangler)</div>}
                        </div>

                        <div className="lp-badges">
                          <div className="lp-badge">Basis: {loc.totals.basis}</div>
                          <div className="lp-badge">Luxus: {loc.totals.luxus}</div>
                          <div className="lp-badge">Totalt: {loc.totals.total}</div>
                        </div>
                      </div>

                      {/* ✅ What customers want */}
                      <div className="lp-notes" style={{ marginTop: 10 }}>
                        <strong>Kundene ønsker:</strong>
                        {loc.choices?.length ? (
                          <div style={{ marginTop: 8 }}>
                            {loc.choices.map((ch) => (
                              <div key={ch.key} style={{ marginBottom: 8 }}>
                                <div className="lp-row" style={{ justifyContent: "space-between" }}>
                                  <div>
                                    <span style={{ fontWeight: 600 }}>{ch.label}</span>
                                  </div>
                                  <div style={{ fontWeight: 700 }}>{ch.total}</div>
                                </div>

                                {ch.variants?.length ? (
                                  <div style={{ marginTop: 4, paddingLeft: 14 }}>
                                    {ch.variants.map((v) => (
                                      <div key={v.name} className="lp-row" style={{ justifyContent: "space-between" }}>
                                        <div className="lp-muted">– {v.name}</div>
                                        <div className="lp-muted" style={{ fontWeight: 700 }}>
                                          {v.count}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="lp-muted" style={{ marginTop: 6 }}>
                            (Ingen menyvalg registrert)
                          </div>
                        )}
                      </div>

                      {loc.flags?.length ? (
                        <div className="lp-flags">
                          {loc.flags.map((f) => (
                            <div key={f} className="lp-flag">
                              <span className="lp-flagDot" />
                              <span>Avvik: {flagLabel(f)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {safeStr(loc.notes) ? (
                        <div className="lp-notes">
                          <strong>Notat:</strong> {loc.notes}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}

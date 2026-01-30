// app/kitchen/report/KitchenReportClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Mode = "day" | "week";

type Totals = { basis: number; luxus: number; total: number };

type LocationOut = {
  locationId: string;
  locationName: string;
  address: string;

  windowFrom?: string | null;
  windowTo?: string | null;
  windowLabel?: string | null;

  totals: Totals;
  notes?: string | null;

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
  // Kun UI convenience – server (API) er sannheten (osloTodayISODate)
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
      {/* Print-first global styles */}
      <style jsx global>{`
        .lp-kitchen-report {
          padding: 16px;
        }

        .lp-card {
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 14px;
          padding: 14px;
          margin: 0 0 12px;
        }

        .lp-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .lp-h1 {
          font-size: 22px;
          margin: 0;
          line-height: 1.2;
        }

        .lp-h2 {
          font-size: 18px;
          margin: 0;
          line-height: 1.25;
        }

        .lp-muted {
          color: rgba(0, 0, 0, 0.6);
          font-size: 13px;
          margin: 6px 0 0;
        }

        .lp-kicker {
          color: rgba(0, 0, 0, 0.55);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .lp-toolbar {
          position: sticky;
          top: 0;
          z-index: 30;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(6px);
        }

        .lp-field {
          display: inline-flex;
          flex-direction: column;
          gap: 6px;
          min-width: 160px;
        }

        .lp-label {
          font-size: 12px;
          color: rgba(0, 0, 0, 0.6);
        }

        .lp-field select,
        .lp-field input {
          height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          padding: 0 10px;
          background: #fff;
          font: inherit;
        }

        .lp-btn {
          height: 38px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.14);
          padding: 0 12px;
          background: #fff;
          cursor: pointer;
          font: inherit;
        }

        .lp-btn:active {
          transform: translateY(1px);
        }

        .lp-totals {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .lp-totalBox {
          min-width: 110px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          padding: 10px 12px;
          background: #fff;
        }

        .lp-num {
          font-size: 20px;
          font-weight: 700;
        }

        .lp-companyHead {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          align-items: baseline;
        }

        .lp-locations {
          margin-top: 10px;
          display: grid;
          gap: 10px;
        }

        .lp-location {
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          padding: 12px;
        }

        .lp-locationTop {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
        }

        .lp-locationMeta {
          display: grid;
          gap: 4px;
        }

        .lp-badges {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .lp-badge {
          font-size: 12px;
          border-radius: 999px;
          padding: 6px 10px;
          border: 1px solid rgba(0, 0, 0, 0.14);
          background: #fff;
          white-space: nowrap;
        }

        .lp-flags {
          margin-top: 8px;
          display: grid;
          gap: 6px;
        }

        .lp-flag {
          font-size: 12px;
          color: rgba(0, 0, 0, 0.7);
          display: flex;
          gap: 8px;
          align-items: flex-start;
        }

        .lp-flagDot {
          margin-top: 6px;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.25);
          flex: 0 0 auto;
        }

        .lp-notes {
          margin-top: 8px;
          font-size: 12px;
          color: rgba(0, 0, 0, 0.7);
          border-top: 1px dashed rgba(0, 0, 0, 0.14);
          padding-top: 8px;
        }

        /* Print */
        @media print {
          .lp-kitchen-report {
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .lp-card {
            border-radius: 0 !important;
            box-shadow: none !important;
            margin: 0 0 10px !important;
          }
          .page-break {
            break-before: page;
            page-break-before: always;
          }
          /* A4-ish spacing: */
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
        }
      `}</style>

      <header className="lp-card lp-toolbar no-print">
        <div className="lp-row">
          <div>
            <h1 className="lp-h1">Kjøkkenrapport</h1>
            <div className="lp-muted">Read-only · firma → lokasjon · totaler + avvik · utskriftsklar</div>
          </div>

          <div className="lp-row" style={{ alignItems: "flex-end" }}>
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
                <div style={{ fontSize: 18, fontWeight: 700 }}>
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
                          <div style={{ fontWeight: 700 }}>{loc.locationName}</div>
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

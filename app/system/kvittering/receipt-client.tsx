"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type ApiErr = { ok: false; rid?: string; error: string; message?: string; detail?: any };
type ReceiptRow = {
  order_id: string;
  created_at: string;
  updated_at: string | null;

  delivery_date: string; // YYYY-MM-DD
  delivery_slot: string | null;
  status: string;
  order_note: string | null;

  company_id: string;
  company_name: string;

  location_id: string;
  location_name: string;

  profile_id: string;
  employee_name: string;
  employee_department: string | null;
};

/* =========================================================
   🔒 STATUS-FASIT (JUSTER HER hvis dere bruker andre ord)
========================================================= */
const ACTIVE_STATUSES = new Set(["confirmed", "active", "ordered"]);
const CANCELED_STATUSES = new Set(["canceled"]);

/* =========================================================
   Utils
========================================================= */
function safeStr(v: any) {
  return String(v ?? "").trim();
}
function lc(v: any) {
  return safeStr(v).toLowerCase();
}
function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function isDDMMYYYY(d: string) {
  return /^\d{2}-\d{2}-\d{4}$/.test(d);
}
function ddmmyyyyToISO(d: string): string | null {
  const t = safeStr(d);
  if (!isDDMMYYYY(t)) return null;
  const [dd, mm, yyyy] = t.split("-");
  const iso = `${yyyy}-${mm}-${dd}`;
  return isISODate(iso) ? iso : null;
}
function isoToDDMMYYYY(iso: string): string {
  if (!isISODate(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${d}-${m}-${y}`;
}
function addDaysISO(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const yy = String(dt.getUTCFullYear()).padStart(4, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function fmtTs(iso?: string | null) {
  try {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
function shortId(id: string) {
  const s = safeStr(id);
  return s.length <= 10 ? s : `${s.slice(0, 10)}…`;
}
function classifyStatus(status: string) {
  const s = lc(status);
  if (CANCELED_STATUSES.has(s)) return "canceled" as const;
  if (ACTIVE_STATUSES.has(s)) return "active" as const;
  // default: behandle som aktiv (drift skal se det)
  return "active" as const;
}

type SlotGroup = {
  slotKey: string; // "—" eller slot
  active: ReceiptRow[];
  canceled: ReceiptRow[];
};
type LocationGroup = {
  locationId: string;
  locationName: string;
  slots: SlotGroup[];
  activeCount: number;
  canceledCount: number;
};
type CompanyGroup = {
  companyId: string;
  companyName: string;
  locations: LocationGroup[];
  activeCount: number;
  canceledCount: number;
};

function groupRows(rows: ReceiptRow[]): CompanyGroup[] {
  const byCompany = new Map<string, CompanyGroup>();

  for (const r of rows) {
    const companyKey = safeStr(r.company_id) || "—";
    const locationKey = safeStr(r.location_id) || "—";
    const slotKey = safeStr(r.delivery_slot) || "—";
    const cls = classifyStatus(r.status);

    let c = byCompany.get(companyKey);
    if (!c) {
      c = {
        companyId: companyKey,
        companyName: safeStr(r.company_name) || "Ukjent firma",
        locations: [],
        activeCount: 0,
        canceledCount: 0,
      };
      byCompany.set(companyKey, c);
    }

    if (cls === "canceled") c.canceledCount += 1;
    else c.activeCount += 1;

    let loc = c.locations.find((x) => x.locationId === locationKey);
    if (!loc) {
      loc = {
        locationId: locationKey,
        locationName: safeStr(r.location_name) || "Ukjent lokasjon",
        slots: [],
        activeCount: 0,
        canceledCount: 0,
      };
      c.locations.push(loc);
    }

    if (cls === "canceled") loc.canceledCount += 1;
    else loc.activeCount += 1;

    let sl = loc.slots.find((x) => x.slotKey === slotKey);
    if (!sl) {
      sl = { slotKey, active: [], canceled: [] };
      loc.slots.push(sl);
    }

    if (cls === "canceled") sl.canceled.push(r);
    else sl.active.push(r);
  }

  const list = Array.from(byCompany.values());
  list.sort((a, b) => a.companyName.localeCompare(b.companyName, "nb"));

  for (const c of list) {
    c.locations.sort((a, b) => a.locationName.localeCompare(b.locationName, "nb"));
    for (const l of c.locations) {
      l.slots.sort((a, b) => a.slotKey.localeCompare(b.slotKey, "nb"));

      for (const s of l.slots) {
        s.active.sort((a, b) => safeStr(a.employee_name).localeCompare(safeStr(b.employee_name), "nb"));
        s.canceled.sort((a, b) => safeStr(a.employee_name).localeCompare(safeStr(b.employee_name), "nb"));
      }
    }
  }

  return list;
}

export default function ReceiptClient() {
  const [isPending, startTransition] = useTransition();

  // UI-input er DD-MM-YYYY
  const [dateDD, setDateDD] = useState<string>("");
  const [isoDate, setIsoDate] = useState<string>("");

  const [rows, setRows] = useState<ReceiptRow[]>([]);
  const [rid, setRid] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  async function fetchRows(iso: string) {
    setErr("");
    const res = await fetch(`/api/system/receipts?date=${encodeURIComponent(iso)}`, {
      method: "GET",
      headers: { "Cache-Control": "no-store" },
    });

    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const e = (json || { ok: false, error: "http_error", message: "Ukjent feil" }) as ApiErr;
      setRid(safeStr(e.rid));
      setRows([]);
      setErr(e.message || "Kunne ikke hente kvittering.");
      setLastUpdated(fmtTs(new Date().toISOString()));
      return;
    }

    setRid(safeStr(json?.rid));
    setRows((json?.rows || []) as ReceiptRow[]);
    setLastUpdated(fmtTs(new Date().toISOString()));
  }

  function applyIso(iso: string) {
    setIsoDate(iso);
    setDateDD(isoToDDMMYYYY(iso));
    startTransition(() => fetchRows(iso));
  }

  // Init: støtt ?date=DD-MM-YYYY
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const dd = safeStr(sp.get("date"));

    if (dd) {
      const iso = ddmmyyyyToISO(dd);
      if (iso) {
        applyIso(iso);
        return;
      }
      setErr("Ugyldig dato i URL. Bruk ?date=DD-MM-YYYY.");
    }

    // fallback: hent dagens via API (uten param) ved å be om i dag = oslo via server
    startTransition(async () => {
      const res = await fetch(`/api/system/receipts`, { method: "GET", headers: { "Cache-Control": "no-store" } });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const e = (json || { ok: false, error: "http_error", message: "Ukjent feil" }) as ApiErr;
        setRid(safeStr(e.rid));
        setErr(e.message || "Kunne ikke hente kvittering.");
        setLastUpdated(fmtTs(new Date().toISOString()));
        return;
      }

      const dIso = safeStr(json?.date);
      setIsoDate(dIso);
      setDateDD(isoToDDMMYYYY(dIso));
      setRid(safeStr(json?.rid));
      setRows((json?.rows || []) as ReceiptRow[]);
      setLastUpdated(fmtTs(new Date().toISOString()));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => groupRows(rows), [rows]);

  function onApplyDate() {
    const iso = ddmmyyyyToISO(dateDD);
    if (!iso) {
      setErr("Ugyldig dato. Bruk DD-MM-YYYY.");
      return;
    }
    applyIso(iso);
  }

  function stepDay(delta: number) {
    const base = isISODate(isoDate) ? isoDate : ddmmyyyyToISO(dateDD);
    if (!base) {
      setErr("Ugyldig dato. Bruk DD-MM-YYYY.");
      return;
    }
    applyIso(addDaysISO(base, delta));
  }

  function refresh() {
    const base = isISODate(isoDate) ? isoDate : ddmmyyyyToISO(dateDD);
    if (!base) {
      setErr("Ugyldig dato. Bruk DD-MM-YYYY.");
      return;
    }
    startTransition(() => fetchRows(base));
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-wrap { padding: 0 !important; }
          .card { box-shadow: none !important; border: 1px solid #ddd !important; }
        }
      `}</style>

      <div className="print-wrap">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-xl font-semibold">Kvittering – ordre@lunchportalen.no</h1>
            <div className="text-sm opacity-70">
              Dato: <span className="font-medium">{dateDD || "—"}</span>
              {rid ? <span className="ml-3">RID: {rid}</span> : null}
              {lastUpdated ? <span className="ml-3">Sist oppdatert: {lastUpdated}</span> : null}
            </div>
          </div>

          <div className="no-print flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => stepDay(-1)} className="rounded-xl border px-3 py-2 text-sm" disabled={isPending}>
                ← Forrige
              </button>
              <button type="button" onClick={() => stepDay(1)} className="rounded-xl border px-3 py-2 text-sm" disabled={isPending}>
                Neste →
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                value={dateDD}
                onChange={(e) => setDateDD(e.target.value)}
                placeholder="DD-MM-YYYY"
                className="w-36 rounded-xl border px-3 py-2 text-sm"
                inputMode="numeric"
              />
              <button type="button" onClick={onApplyDate} className="rounded-xl border px-3 py-2 text-sm" disabled={isPending}>
                Hent
              </button>
              <button type="button" onClick={refresh} className="rounded-xl border px-3 py-2 text-sm" disabled={isPending}>
                Oppdater
              </button>
              <button type="button" onClick={() => window.print()} className="rounded-xl border px-3 py-2 text-sm" disabled={isPending}>
                Skriv ut
              </button>
            </div>
          </div>
        </div>

        {err ? (
          <div className="mb-4 rounded-2xl border p-4 text-sm">
            <div className="font-medium">Feil</div>
            <div className="opacity-80">{err}</div>
          </div>
        ) : null}

        {grouped.length === 0 ? (
          <div className="rounded-2xl border p-6 text-sm opacity-80">Ingen ordre for valgt dato.</div>
        ) : (
          <div className="space-y-4">
            {grouped.map((c) => (
              <div key={c.companyId} className="card rounded-2xl border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-lg font-semibold">{c.companyName}</div>
                  <div className="text-sm opacity-80">
                    Aktive: <span className="font-medium">{c.activeCount}</span>
                    <span className="mx-2">|</span>
                    Avbestilt: <span className="font-medium">{c.canceledCount}</span>
                  </div>
                </div>

                <div className="mt-3 space-y-4">
                  {c.locations.map((l) => (
                    <div key={l.locationId} className="rounded-2xl border p-3">
                      <div className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div className="font-medium">{l.locationName}</div>
                        <div className="text-sm opacity-80">
                          Aktive: <span className="font-medium">{l.activeCount}</span>
                          <span className="mx-2">|</span>
                          Avbestilt: <span className="font-medium">{l.canceledCount}</span>
                        </div>
                      </div>

                      {l.slots.map((s) => (
                        <div key={s.slotKey} className="mb-3 last:mb-0">
                          <div className="mb-2 text-sm opacity-80">
                            Leveringsslot: <span className="font-medium">{s.slotKey}</span>
                            <span className="ml-3">
                              Aktive: <span className="font-medium">{s.active.length}</span>
                              <span className="mx-2">|</span>
                              Avbestilt: <span className="font-medium">{s.canceled.length}</span>
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="py-2 text-left font-medium">Ansatt</th>
                                  <th className="py-2 text-left font-medium">Avdeling</th>
                                  <th className="py-2 text-left font-medium">Notat</th>
                                  <th className="py-2 text-left font-medium">Status</th>
                                  <th className="py-2 text-left font-medium">Tid</th>
                                  <th className="py-2 text-left font-medium">OrderId</th>
                                </tr>
                              </thead>
                              <tbody>
                                {s.active.length === 0 ? (
                                  <tr>
                                    <td className="py-3 opacity-70" colSpan={6}>
                                      Ingen aktive ordre i denne gruppen.
                                    </td>
                                  </tr>
                                ) : (
                                  s.active.map((r) => (
                                    <tr key={r.order_id} className="border-b last:border-b-0">
                                      <td className="py-2">{safeStr(r.employee_name) || "—"}</td>
                                      <td className="py-2">{safeStr(r.employee_department) || "—"}</td>
                                      <td className="py-2">{safeStr(r.order_note) || "—"}</td>
                                      <td className="py-2">{safeStr(r.status) || "—"}</td>
                                      <td className="py-2">{fmtTs(r.updated_at || r.created_at)}</td>
                                      <td className="py-2">{shortId(r.order_id)}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>

                          {s.canceled.length > 0 ? (
                            <div className="mt-3 rounded-2xl border p-3">
                              <div className="mb-2 text-sm font-medium">Avbestilte</div>
                              <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-sm">
                                  <thead>
                                    <tr className="border-b">
                                      <th className="py-2 text-left font-medium">Ansatt</th>
                                      <th className="py-2 text-left font-medium">Avdeling</th>
                                      <th className="py-2 text-left font-medium">Notat</th>
                                      <th className="py-2 text-left font-medium">Tid</th>
                                      <th className="py-2 text-left font-medium">OrderId</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {s.canceled.map((r) => (
                                      <tr key={r.order_id} className="border-b last:border-b-0">
                                        <td className="py-2">{safeStr(r.employee_name) || "—"}</td>
                                        <td className="py-2">{safeStr(r.employee_department) || "—"}</td>
                                        <td className="py-2">{safeStr(r.order_note) || "—"}</td>
                                        <td className="py-2">{fmtTs(r.updated_at || r.created_at)}</td>
                                        <td className="py-2">{shortId(r.order_id)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 text-xs opacity-60">
          UI-dato: DD-MM-YYYY. API-dato: YYYY-MM-DD. URL-støtte: ?date=DD-MM-YYYY
        </div>
      </div>
    </div>
  );
}

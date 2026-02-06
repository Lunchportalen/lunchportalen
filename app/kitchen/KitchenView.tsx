// app/kitchen/KitchenView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { isAfterCutoff0800 } from "@/lib/kitchen/cutoff";

type KitchenOrder = {
  id: string;
  full_name: string;
  department: string | null;
  note: string | null;
};

type KitchenGroup = {
  delivery_date: string;
  delivery_window: string;
  company: string;
  location: string;
  company_id: string;
  location_id: string;
  orders: KitchenOrder[];
};

type LocationGroup = {
  locationId: string;
  location: string;
  orders: KitchenOrder[];
  total: number;
};

type CompanyGroup = {
  companyId: string;
  company: string;
  locations: LocationGroup[];
  total: number;
};

type WindowGroup = {
  window: string;
  companies: CompanyGroup[];
  total: number;
};

type KitchenFetch = {
  rid: string;
  groups: KitchenGroup[];
};

const OSLO_TZ = "Europe/Oslo";

function safeJsonParse<T>(txt: string): T | null {
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function fmtOsloYMDNow() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: OSLO_TZ }).format(new Date());
}

function fmtOsloHMNow() {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      timeZone: OSLO_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "";
  }
}

function formatDateForLocale(iso: string) {
  if (!iso || !isISODate(iso)) return iso;
  const loc = typeof navigator !== "undefined" && navigator.language ? navigator.language.toLowerCase() : "en";
  if (loc.startsWith("nb-no") || loc.startsWith("nn-no")) {
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }
  return iso;
}

function buildGroups(rows: KitchenGroup[] | null): WindowGroup[] {
  if (!rows || rows.length === 0) return [];

  const windows: WindowGroup[] = [];
  const windowIndex = new Map<string, WindowGroup>();

  for (const g of rows) {
    const windowKey = g.delivery_window || "Standard";
    let win = windowIndex.get(windowKey);
    if (!win) {
      win = { window: windowKey, companies: [], total: 0 };
      windowIndex.set(windowKey, win);
      windows.push(win);
    }

    let comp = win.companies.find((c) => c.companyId === g.company_id);
    if (!comp) {
      comp = { companyId: g.company_id, company: g.company, locations: [], total: 0 };
      win.companies.push(comp);
    }

    let loc = comp.locations.find((l) => l.locationId === g.location_id);
    if (!loc) {
      loc = { locationId: g.location_id, location: g.location, orders: [], total: 0 };
      comp.locations.push(loc);
    }

    const orderCount = g.orders?.length ?? 0;
    loc.orders = [...loc.orders, ...g.orders];
    loc.total += orderCount;
    comp.total += orderCount;
    win.total += orderCount;
  }

  return windows;
}

export default function KitchenView() {
  const [data, setData] = useState<KitchenGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [hardErr, setHardErr] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  const [dateISO] = useState<string>(fmtOsloYMDNow());

  async function fetchDayOnce(dISO: string): Promise<KitchenFetch> {
    if (!isISODate(dISO)) throw new Error("Ugyldig dato");
    const requestRid = `kitchen_day_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const res = await fetch(`/api/kitchen/day?date=${encodeURIComponent(dISO)}`, {
      cache: "no-store",
      headers: { "x-rid": requestRid },
    });

    const txt = await res.text();
    const json = safeJsonParse<any>(txt);

    if (!res.ok) {
      const detail = typeof json?.detail === "string" ? json.detail : json?.detail ? JSON.stringify(json.detail) : null;
      throw new Error(detail || json?.message || json?.error || txt || "Kunne ikke hente kjøkkenliste");
    }

    const payload = (json as any)?.data ?? json;
    if (payload && Array.isArray(payload.groups)) {
      return { rid: requestRid, groups: payload.groups as KitchenGroup[] };
    }
    if (Array.isArray(payload)) return { rid: requestRid, groups: payload as KitchenGroup[] };
    if (json && typeof json === "object" && json.ok === false) {
      throw new Error(json?.message || json?.error || "Kunne ikke hente kjøkkenliste");
    }
    throw new Error("Ugyldig respons fra server");
  }

  async function load() {
    try {
      const res = await fetchDayOnce(dateISO);
      setData(res.groups);
      setLastUpdated(fmtOsloHMNow());
      setHardErr(null);
      setRid(res.rid);
    } catch (e: any) {
      setHardErr(e?.message || "Kunne ikke hente kjøkkenliste");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  const frozen = useMemo(() => isAfterCutoff0800(dateISO), [dateISO]);
  const totalKuverter = useMemo(() => (data ?? []).reduce((sum, g) => sum + (g.orders?.length ?? 0), 0), [data]);
  const dateLabel = formatDateForLocale(dateISO);
  const windows = useMemo(() => buildGroups(data), [data]);

  return (
    <div className="lp-card p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-[rgb(var(--lp-muted))]">Produksjonsdato</div>
          <div className="mt-1 text-2xl font-semibold text-[rgb(var(--lp-fg))]">{dateLabel}</div>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">ACTIVE / READY FOR PRODUCTION</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Dette er fasit. Ingen manuelle unntak.</div>
        </div>
        <div className="text-sm text-[rgb(var(--lp-muted))]">
          Cut-off 08:00 · Sist oppdatert: {lastUpdated ?? "Ikke tilgjengelig"}
          {rid ? <div className="mt-1 text-xs">RID: {rid}</div> : null}
        </div>
      </div>

      {hardErr && (!data || data.length === 0) && (
        <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-[rgb(var(--lp-muted))]">{hardErr}</div>
      )}

      {!loading && (!data || data.length === 0) && !hardErr && (
        <div className="mt-6 text-sm text-[rgb(var(--lp-muted))]">Ingen aktive bestillinger for valgt dato.</div>
      )}

      {data && data.length > 0 && (
        <>
          <div className="mt-6 text-sm text-[rgb(var(--lp-muted))]">
            Totalt kuverter: <span className="font-semibold text-[rgb(var(--lp-fg))]">{totalKuverter}</span>
          </div>

          <div className="mt-6 space-y-6">
            {windows.map((w) => (
              <section key={w.window} className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-base font-semibold text-[rgb(var(--lp-fg))]">Leveringsvindu: {w.window}</div>
                  <div className="text-sm text-[rgb(var(--lp-muted))]">
                    Totalt: <span className="font-semibold text-[rgb(var(--lp-fg))]">{w.total}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {w.companies.map((c) => (
                    <div key={c.companyId} className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-base font-semibold text-[rgb(var(--lp-fg))]">{c.company}</div>
                        <div className="text-sm text-[rgb(var(--lp-muted))]">
                          Totalt firma: <span className="font-semibold text-[rgb(var(--lp-fg))]">{c.total}</span>
                        </div>
                      </div>

                      <div className="mt-3 space-y-3">
                        {c.locations.map((l) => (
                          <div key={`${c.companyId}:${l.locationId}`} className="rounded-xl bg-[rgb(var(--lp-surface-2))] p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="font-medium text-[rgb(var(--lp-fg))]">{l.location}</div>
                              <div className="text-sm text-[rgb(var(--lp-muted))]">
                                Totalt lokasjon: <span className="font-semibold text-[rgb(var(--lp-fg))]">{l.total}</span>
                              </div>
                            </div>

                            <div className="mt-3 space-y-2">
                              {l.orders.map((o) => (
                                <div key={o.id} className="rounded-xl bg-white px-4 py-3">
                                  <div className="text-sm font-semibold text-[rgb(var(--lp-fg))]">{o.full_name}</div>
                                  {o.department ? (
                                    <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{o.department}</div>
                                  ) : null}
                                  {o.note ? (
                                    <div className="mt-2 text-sm text-[rgb(var(--lp-fg))] lp-wrap-anywhere">{o.note}</div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {!frozen.after && (
        <div className="mt-5 text-xs text-[rgb(var(--lp-muted))]">
          Ordrene under er klare for produksjon. Endringer etter cut-off registreres som avvik.
        </div>
      )}
    </div>
  );
}

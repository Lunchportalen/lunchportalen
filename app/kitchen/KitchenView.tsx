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

export default function KitchenView() {
  const [data, setData] = useState<KitchenGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [hardErr, setHardErr] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const [dateISO] = useState<string>(fmtOsloYMDNow());

  async function fetchDayOnce(dISO: string): Promise<KitchenGroup[]> {
    if (!isISODate(dISO)) throw new Error("Ugyldig dato");
    const rid = `kitchen_day_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const res = await fetch(`/api/kitchen/day?date=${encodeURIComponent(dISO)}`, {
      cache: "no-store",
      headers: { "x-rid": rid },
    });

    const txt = await res.text();
    const json = safeJsonParse<any>(txt);

    if (!res.ok) {
      const detail = typeof json?.detail === "string" ? json.detail : json?.detail ? JSON.stringify(json.detail) : null;
      throw new Error(detail || json?.message || json?.error || txt || "Kunne ikke hente kjøkkenliste");
    }

    const payload = (json as any)?.data ?? json;
    if (payload && Array.isArray(payload.groups)) {
      return payload.groups as KitchenGroup[];
    }
    if (Array.isArray(payload)) return payload as KitchenGroup[];
    if (json && typeof json === "object" && json.ok === false) {
      throw new Error(json?.message || json?.error || "Kunne ikke hente kjøkkenliste");
    }
    throw new Error("Ugyldig respons fra server");
  }

  async function load() {
    try {
      const groups = await fetchDayOnce(dateISO);
      setData(groups);
      setLastUpdated(fmtOsloHMNow());
      setHardErr(null);
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

  return (
    <div className="lp-card lp-card-pad">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm text-[rgb(var(--lp-muted))]">Produksjon for {dateLabel}</div>
          <div className="mt-1 text-2xl font-semibold text-[rgb(var(--lp-fg))]">Kjøkken</div>
        </div>
        <div className="text-sm text-[rgb(var(--lp-muted))]">
          Frosset kl. 08:00 · Sist oppdatert: {lastUpdated ?? "Ikke tilgjengelig"}
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

          <div className="mt-6 space-y-5">
            {data.map((g) => (
              <section key={`${g.delivery_date}:${g.delivery_window}:${g.company_id}:${g.location_id}`} className="rounded-[var(--lp-radius)] bg-[rgb(var(--lp-surface))] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-[rgb(var(--lp-fg))]">
                      {g.delivery_window} · {g.company}
                    </div>
                    <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{g.location}</div>
                  </div>
                  <div className="text-sm text-[rgb(var(--lp-muted))]">
                    Kuverter: <span className="font-semibold text-[rgb(var(--lp-fg))]">{g.orders.length}</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {g.orders.map((o) => (
                    <div key={o.id} className="rounded-2xl bg-white/70 px-4 py-3">
                      <div className="text-sm font-semibold text-[rgb(var(--lp-fg))]">{o.full_name}</div>
                      {o.department ? <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{o.department}</div> : null}
                      {o.note ? <div className="mt-2 text-sm text-[rgb(var(--lp-fg))]">{o.note}</div> : null}
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {!frozen.after && (
        <div className="mt-5 text-xs text-[rgb(var(--lp-muted))]">Endringer kan forekomme frem til 08:00.</div>
      )}
    </div>
  );
}

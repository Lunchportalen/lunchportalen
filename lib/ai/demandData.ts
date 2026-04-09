/**
 * Delte hjelpefunksjoner for etterspørselsprognoser — kun strukturering av faktiske ordredata.
 * Ingen skjulte antakelser utover definert cut-off (samme som admin innsikt).
 */

import { OSLO_TZ } from "@/lib/date/oslo";

export type OrderRowForDemand = {
  date: string;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  /** Valgfri — brukes til fler-lokasjon / multi-city aggregat (additiv). */
  location_id?: string | null;
};

function toOsloParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    yyyy: get("year"),
    mm: get("month"),
    dd: get("day"),
    hh: Number(get("hour")),
    mi: Number(get("minute")),
  };
}

/** Avbestilling registrert før 08:00 Oslo på leveringsdag (reduserer planlagt produksjon). */
export function isCancelledBeforeOsloCutoff(orderDateISO: string, updatedAt: string | null | undefined): boolean {
  if (!updatedAt) return false;
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return false;
  const p = toOsloParts(d);
  const dateLocal = `${p.yyyy}-${p.mm}-${p.dd}`;
  if (dateLocal < orderDateISO) return true;
  if (dateLocal > orderDateISO) return false;
  const minutes = p.hh * 60 + p.mi;
  return minutes < 8 * 60;
}

export function statusIsActive(status: string | null | undefined): boolean {
  return String(status ?? "").toUpperCase() === "ACTIVE";
}

export function statusIsCancelled(status: string | null | undefined): boolean {
  return String(status ?? "").toUpperCase() === "CANCELLED";
}

export type DailyDemandAgg = {
  date: string;
  /** Ordre som endte som ACTIVE (kjøkkenbehov). */
  activeCount: number;
  /** Avbestillinger før cut-off (reduserer etterspørsel i modellen). */
  cancelledBeforeCutoff: number;
  /** Øvrige avbestillinger / statusendringer etter cut-off. */
  cancelledAfterCutoff: number;
  /** Alle ordre-rader den dagen. */
  totalRows: number;
};

/**
 * Aggregerer ordre-rader per dato. Ingen database — kun deterministisk telling.
 */
export function aggregateOrdersByDate(rows: OrderRowForDemand[]): Map<string, DailyDemandAgg> {
  const map = new Map<string, DailyDemandAgg>();

  for (const r of rows) {
    const date = String(r.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const cur =
      map.get(date) ??
      ({
        date,
        activeCount: 0,
        cancelledBeforeCutoff: 0,
        cancelledAfterCutoff: 0,
        totalRows: 0,
      } satisfies DailyDemandAgg);

    cur.totalRows += 1;
    if (statusIsActive(r.status)) cur.activeCount += 1;
    else if (statusIsCancelled(r.status)) {
      const before = isCancelledBeforeOsloCutoff(date, r.updated_at ?? r.created_at);
      if (before) cur.cancelledBeforeCutoff += 1;
      else cur.cancelledAfterCutoff += 1;
    }

    map.set(date, cur);
  }

  return map;
}

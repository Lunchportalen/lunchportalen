// app/lib/cutoff.ts
// ✅ Ingen eksterne deps. Bruker kun Intl + Date.
// ✅ Europe/Oslo + cut-off 08:00

export const OSLO_TZ = "Europe/Oslo";
export const CUTOFF_HOUR = 8;
export const CUTOFF_MINUTE = 0;

export type CutoffStatus = {
  nowOsloISO: string; // YYYY-MM-DD
  nowOsloTime: string; // HH:MM:SS
  cutoffTime: string; // "08:00"
  isLocked: boolean;
};

export class CutoffError extends Error {
  code = "CUTOFF" as const;
  constructor(message: string) {
    super(message);
    this.name = "CutoffError";
  }
}

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function cutoffTimeLabel() {
  return `${pad2(CUTOFF_HOUR)}:${pad2(CUTOFF_MINUTE)}`;
}

function osloParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");

  const isoDate = `${y}-${m}-${d}`;
  const time = `${hh}:${mm}:${ss}`;
  const minutes = Number(hh) * 60 + Number(mm);

  return { isoDate, time, minutes };
}

function compareISODate(a: string, b: string) {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/**
 * Returnerer true hvis datoen er låst:
 * - Tidligere datoer: låst
 * - Fremtidige datoer: ikke låst
 * - Samme dag: låst fra og med 08:00 Oslo-tid
 */
export function isCutoffLocked(deliveryDateISO: string, now: Date = new Date()) {
  const dateISO = String(deliveryDateISO ?? "").trim();
  if (!isISODate(dateISO)) return true; // sikker default

  const oslo = osloParts(now);
  const today = oslo.isoDate;

  const cmp = compareISODate(dateISO, today);
  if (cmp < 0) return true;
  if (cmp > 0) return false;

  const cutoffMinutes = CUTOFF_HOUR * 60 + CUTOFF_MINUTE;
  return oslo.minutes >= cutoffMinutes;
}

/**
 * Kaster error hvis dato er låst (API-bruk).
 * Feilen har code="CUTOFF" slik at routes kan gi 409 i korrekt shape.
 */
export function assertNotLocked(deliveryDateISO: string, actionLabel = "Handling") {
  if (isCutoffLocked(deliveryDateISO)) {
    throw new CutoffError(`${actionLabel} er stengt etter cut-off kl. ${cutoffTimeLabel()} (Oslo-tid).`);
  }
}

/**
 * Status for "nå" i Oslo.
 */
export function cutoffStatusNow(now: Date = new Date()): CutoffStatus {
  const oslo = osloParts(now);
  const cutoffMinutes = CUTOFF_HOUR * 60 + CUTOFF_MINUTE;

  return {
    nowOsloISO: oslo.isoDate,
    nowOsloTime: oslo.time,
    cutoffTime: cutoffTimeLabel(),
    isLocked: oslo.minutes >= cutoffMinutes,
  };
}

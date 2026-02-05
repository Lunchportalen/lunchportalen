// lib/cutoff.ts
// ✅ Europe/Oslo + cut-off 08:00

import { OSLO_TZ, isAfterCutoff0800, isIsoDate, osloNowParts, osloTodayISODate } from "@/lib/date/oslo";

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

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function cutoffTimeLabel() {
  return `${pad2(CUTOFF_HOUR)}:${pad2(CUTOFF_MINUTE)}`;
}

function nowOsloParts(now: Date) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    return osloNowParts();
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
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

  return {
    yyyy: get("year"),
    mm: get("month"),
    dd: get("day"),
    hh: Number(get("hour")),
    mi: Number(get("minute")),
    ss: Number(get("second")),
  };
}

/**
 * Returnerer true hvis datoen er låst:
 * - Tidligere datoer: låst
 * - Fremtidige datoer: ikke låst
 * - Samme dag: låst fra og med 08:00 Oslo-tid
 */
export function isCutoffLocked(deliveryDateISO: string, now: Date = new Date()) {
  const dateISO = String(deliveryDateISO ?? "").trim();
  if (!isIsoDate(dateISO)) return true; // sikker default

  const oslo = nowOsloParts(now);
  const today = `${oslo.yyyy}-${oslo.mm}-${oslo.dd}`;

  if (dateISO < today) return true;
  if (dateISO > today) return false;

  const cutoffMinutes = CUTOFF_HOUR * 60 + CUTOFF_MINUTE;
  return oslo.hh * 60 + oslo.mi >= cutoffMinutes;
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
 * HARD cutoff basert på "nå"
 * Brukes kun der handling ALLTID gjelder i dag
 */
export function assertBeforeCutoff0800(action: string): void {
  if (isAfterCutoff0800()) {
    const err: CutoffError = new CutoffError(`${action} er stengt etter kl. 08:00 (Oslo-tid).`);
    throw err;
  }
}

/**
 * HARD cutoff per leveringsdato
 * Cutoff gjelder KUN hvis deliveryDate === i dag
 */
export function assertBeforeCutoffForDeliveryDate(action: string, deliveryDateISO: string): void {
  const today = osloTodayISODate();
  if (deliveryDateISO === today && isAfterCutoff0800()) {
    const err: CutoffError = new CutoffError(
      `${action} for ${deliveryDateISO} er stengt etter kl. 08:00 (Oslo-tid).`
    );
    throw err;
  }
}

/**
 * Status for "nå" i Oslo.
 */
export function cutoffStatusNow(now: Date = new Date()): CutoffStatus {
  const oslo = nowOsloParts(now);
  const cutoffMinutes = CUTOFF_HOUR * 60 + CUTOFF_MINUTE;

  return {
    nowOsloISO: `${oslo.yyyy}-${oslo.mm}-${oslo.dd}`,
    nowOsloTime: `${pad2(oslo.hh)}:${pad2(oslo.mi)}:${pad2(oslo.ss)}`,
    cutoffTime: cutoffTimeLabel(),
    isLocked: oslo.hh * 60 + oslo.mi >= cutoffMinutes,
  };
}

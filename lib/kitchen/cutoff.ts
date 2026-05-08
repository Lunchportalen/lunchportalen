// lib/kitchen/cutoff.ts
const OSLO_TZ = "Europe/Oslo";
export const CUTOFF_BUFFER_MINUTES = 5;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseISODate(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function formatParts(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    hh: Number(get("hour")),
    mm: Number(get("minute")),
    ss: Number(get("second")),
  };
}

function zonedTimeToUtcDate(dateISO: string, hh: number, mm: number, timeZone: string) {
  const parsed = parseISODate(dateISO);
  if (!parsed) return null;
  let guess = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, hh, mm, 0));

  for (let i = 0; i < 3; i++) {
    const p = formatParts(guess, timeZone);
    const actual = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
    const desired = Date.UTC(parsed.y, parsed.m - 1, parsed.d, hh, mm, 0);
    const diffMs = actual - desired;
    if (diffMs === 0) break;
    guess = new Date(guess.getTime() - diffMs);
  }

  return guess;
}

export function cutoffAtUTCISO(dateISO: string, timeZone = OSLO_TZ) {
  const d = zonedTimeToUtcDate(dateISO, 8, 0, timeZone);
  if (!d) return null;
  return d.toISOString();
}

export function cutoffAtUTCISO0805(dateISO: string, timeZone = OSLO_TZ) {
  // 08:00 is the employee order cutoff; kitchen waits the fixed buffer before starting production.
  const d = zonedTimeToUtcDate(dateISO, 8, CUTOFF_BUFFER_MINUTES, timeZone);
  if (!d) return null;
  return d.toISOString();
}

export function isAfterCutoff0800(dateISO: string, timeZone = OSLO_TZ) {
  // Employee cutoff: orders can no longer be changed after 08:00 Europe/Oslo.
  const cutoff = zonedTimeToUtcDate(dateISO, 8, 0, timeZone);
  if (!cutoff) return { after: false, reason: "INVALID_DATE" as const, cutoffAt: null as string | null };

  const now = new Date();
  const nowParts = formatParts(now, timeZone);
  const nowDate = `${nowParts.y}-${pad(nowParts.m)}-${pad(nowParts.d)}`;

  if (nowDate < dateISO) return { after: false, reason: "FUTURE" as const, cutoffAt: cutoff.toISOString() };
  if (nowDate > dateISO) return { after: true, reason: "PAST" as const, cutoffAt: cutoff.toISOString() };

  const nowLocalMinutes = nowParts.hh * 60 + nowParts.mm;
  const cutoffMinutes = 8 * 60;
  if (nowLocalMinutes < cutoffMinutes) return { after: false, reason: "BEFORE" as const, cutoffAt: cutoff.toISOString() };
  return { after: true, reason: "AFTER" as const, cutoffAt: cutoff.toISOString() };
}

export function isAfterCutoff0805(dateISO: string, timeZone = OSLO_TZ) {
  // Kitchen buffer: batch start is blocked until 08:05 so every employee order is locked first.
  const cutoff = zonedTimeToUtcDate(dateISO, 8, CUTOFF_BUFFER_MINUTES, timeZone);
  if (!cutoff) return { after: false, reason: "INVALID_DATE" as const, cutoffAt: null as string | null };

  const now = new Date();
  const nowParts = formatParts(now, timeZone);
  const nowDate = `${nowParts.y}-${pad(nowParts.m)}-${pad(nowParts.d)}`;

  if (nowDate < dateISO) return { after: false, reason: "FUTURE" as const, cutoffAt: cutoff.toISOString() };
  if (nowDate > dateISO) return { after: true, reason: "PAST" as const, cutoffAt: cutoff.toISOString() };

  const nowLocalMinutes = nowParts.hh * 60 + nowParts.mm;
  const cutoffMinutes = 8 * 60 + CUTOFF_BUFFER_MINUTES;
  if (nowLocalMinutes < cutoffMinutes) return { after: false, reason: "BEFORE" as const, cutoffAt: cutoff.toISOString() };
  return { after: true, reason: "AFTER" as const, cutoffAt: cutoff.toISOString() };
}

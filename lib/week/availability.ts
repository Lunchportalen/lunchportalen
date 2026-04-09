// lib/week/availability.ts
const OSLO_TZ = "Europe/Oslo";

/**
 * RULES (OSLO TIME):
 * - Avbestilling samme dag: før 08:00
 * - Bestilling: for hele inneværende uke (Man–Fre), men ikke etter 08:00 på den aktuelle dagen
 * - Neste uke åpner: torsdag 08:00 (kan se/bestille neste uke)
 * - Denne uka skjules: fredag 15:00 (inneværende uke skal ikke vises etter dette)
 */

/** ---------- Oslo time helpers (zero deps) ---------- */

type OsloParts = {
  y: number;
  mo: number; // 1-12
  d: number; // 1-31
  h: number; // 0-23
  mi: number; // 0-59
  weekday: number; // 0=Sun..6=Sat (Oslo)
};

const dtfParts = new Intl.DateTimeFormat("en-GB", {
  timeZone: OSLO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

function cleanWeekday(raw: string) {
  // Tåler "Thu", "tor.", "tors.", osv. (og evt locale-varianter)
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/\s+/g, "");
}

function weekdayToNum(raw: string): number {
  const w = cleanWeekday(raw);

  // English short
  if (w.startsWith("sun")) return 0;
  if (w.startsWith("mon")) return 1;
  if (w.startsWith("tue")) return 2;
  if (w.startsWith("wed")) return 3;
  if (w.startsWith("thu")) return 4;
  if (w.startsWith("fri")) return 5;
  if (w.startsWith("sat")) return 6;

  // Norwegian short (fallback safety)
  if (w.startsWith("søn") || w.startsWith("son")) return 0;
  if (w.startsWith("man")) return 1;
  if (w.startsWith("tir")) return 2;
  if (w.startsWith("ons")) return 3;
  if (w.startsWith("tor") || w.startsWith("tors")) return 4;
  if (w.startsWith("fre")) return 5;
  if (w.startsWith("lør") || w.startsWith("lor")) return 6;

  return 0;
}

function numPart(v: string) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

function osloParts(date: Date): OsloParts {
  const parts = dtfParts.formatToParts(date);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const wdRaw = pick("weekday");

  return {
    y: numPart(pick("year")),
    mo: numPart(pick("month")),
    d: numPart(pick("day")),
    h: numPart(pick("hour")),
    mi: numPart(pick("minute")),
    weekday: weekdayToNum(wdRaw),
  };
}

function hhmmToMin(p: { h: number; mi: number }) {
  return p.h * 60 + p.mi;
}

// Get offset like "GMT+01:00" for a given instant
const dtfOffset = new Intl.DateTimeFormat("en-GB", {
  timeZone: OSLO_TZ,
  timeZoneName: "shortOffset",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function osloOffsetMinutes(at: Date): number {
  const parts = dtfOffset.formatToParts(at);
  const tz = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+00:00";
  const m = tz.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2] ?? 0);
  const mm = Number(m[3] ?? 0);
  return sign * (hh * 60 + mm);
}

/**
 * Create a Date for a given Oslo local wall time (y/mo/d h:mi) safely.
 * Iterates a couple of times to stabilize around DST boundaries.
 */
function makeOsloDate(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): Date {
  let guess = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  for (let i = 0; i < 3; i++) {
    const off = osloOffsetMinutes(guess);
    const utcMillis = Date.UTC(y, mo - 1, d, h, mi, s) - off * 60_000;
    const next = new Date(utcMillis);
    if (Math.abs(next.getTime() - guess.getTime()) < 1) break;
    guess = next;
  }
  return guess;
}

function dateKeyOslo(date: Date): number {
  const p = osloParts(date);
  return p.y * 10000 + p.mo * 100 + p.d;
}

function addDaysOsloYMD(y: number, mo: number, d: number, addDays: number) {
  // Use UTC noon to avoid DST edge weirdness, then read back Oslo YMD
  const utcNoon = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0) + addDays * 86_400_000);
  const p = osloParts(utcNoon);
  return { y: p.y, mo: p.mo, d: p.d };
}

/** ---------- Rules ---------- */

/**
 * Friday 15:00 gate (and weekend) — én sannhet for ukesynlighet.
 *
 * IMPORTANT: Søndag har weekday=0.
 * Helg (lør/søn) skal alltid være "etter fredag", ellers vil søndag feilaktig
 * la "denne uke" være synlig.
 */
export function isAfterFriday1500(now: Date) {
  const p = osloParts(now);

  // Weekend must be treated as "after Friday"
  if (p.weekday === 6 || p.weekday === 0) return true;

  // Friday from 15:00 Oslo
  return p.weekday === 5 && hhmmToMin(p) >= 15 * 60;
}

/** @deprecated Bruk isAfterFriday1500 (fredag 15:00). */
export const isAfterFriday1400 = isAfterFriday1500;

/**
 * Thursday 08:00 gate (next week opens)
 * IMPORTANT: Når den først er åpnet, skal den være åpen resten av helgen (fre/lør/søn).
 */
export function nextWeekOpens(now: Date) {
  const p = osloParts(now);

  // After Thursday, it stays open through Fri/Sat/Sun
  // weekday: 0=Sun, 4=Thu, 5=Fri, 6=Sat
  if (p.weekday === 5 || p.weekday === 6 || p.weekday === 0) return true;

  // Thursday from 08:00
  if (p.weekday === 4) return hhmmToMin(p) >= 8 * 60;

  // Mon–Wed: not open yet
  return false;
}

export function canSeeThisWeek(now: Date) {
  return !isAfterFriday1500(now);
}

export function canSeeNextWeek(now: Date) {
  return nextWeekOpens(now);
}

// Same-day cutoff 08:00
export function dayCutoff0800(date: Date, now: Date) {
  const n = osloParts(now);
  const d = osloParts(date);

  const sameDay = n.y === d.y && n.mo === d.mo && n.d === d.d;
  if (!sameDay) return false;

  return hhmmToMin(n) >= 8 * 60;
}

export function canModifyOrderForDate(date: Date, now: Date) {
  const nKey = dateKeyOslo(now);
  const dKey = dateKeyOslo(date);

  if (dKey < nKey) return false; // past date
  if (dKey === nKey) return !dayCutoff0800(date, now); // today before 08:00
  return true; // future date
}

export function weekStartMon(now: Date) {
  const p = osloParts(now);
  // Monday = 1
  const delta = (p.weekday + 6) % 7; // Mon->0, Tue->1 ... Sun->6
  const base = addDaysOsloYMD(p.y, p.mo, p.d, -delta);
  return makeOsloDate(base.y, base.mo, base.d, 0, 0, 0);
}

/**
 * Visible week starts (Oslo local Mondays 00:00):
 * - This week if before Friday 15:00
 * - Next week if from Thursday 08:00 (and through weekend)
 */
export function visibleWeekStarts(now: Date) {
  const thisStart = weekStartMon(now);
  const thisP = osloParts(thisStart);
  const nextYMD = addDaysOsloYMD(thisP.y, thisP.mo, thisP.d, 7);
  const nextStart = makeOsloDate(nextYMD.y, nextYMD.mo, nextYMD.d, 0, 0, 0);

  const weeks: Date[] = [];
  if (canSeeThisWeek(now)) weeks.push(thisStart);
  if (canSeeNextWeek(now)) weeks.push(nextStart);
  return weeks;
}

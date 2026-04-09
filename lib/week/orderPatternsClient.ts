/**
 * Klient-side mønster for ukevisning (localStorage).
 * Ingen API — deterministisk, forklarbar assistanse (ikke auto-bestilling).
 */

import { addDaysISO, osloNowParts, osloTodayISODate } from "@/lib/date/oslo";
import { weekStartMon } from "@/lib/week/availability";

export const ORDER_PATTERNS_LS_KEY = "lp_order_patterns";
const LEGACY_WEEKDAY_KEY = "lp-week-pref-weekday";

export type OrderPatterns = {
  weekdayStats: Record<string, number>;
  lastOrders: string[];
  streakCount: number;
  lastStreakWeekStart: string | null;
};

const WEEK_KEYS = ["mon", "tue", "wed", "thu", "fri"] as const;

const EMPTY: OrderPatterns = {
  weekdayStats: { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0 },
  lastOrders: [],
  streakCount: 0,
  lastStreakWeekStart: null,
};

export function weekdayKeyFromDateISO(dateISO: string): string | null {
  try {
    const wd = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Oslo",
      weekday: "short",
    }).format(new Date(`${dateISO}T12:00:00Z`));
    const map: Record<string, string> = {
      Mon: "mon",
      Tue: "tue",
      Wed: "wed",
      Thu: "thu",
      Fri: "fri",
    };
    return map[wd] ?? null;
  } catch {
    return null;
  }
}

/** Mandag (YYYY-MM-DD) i Oslo for uken som inneholder bestillingsdato. */
export function mondayISOOsloForCalendarDate(dateISO: string): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const mon = weekStartMon(d);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(mon);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function migrateLegacyWeekday(patterns: OrderPatterns): OrderPatterns {
  if (typeof window === "undefined") return patterns;
  try {
    const legacy = localStorage.getItem(LEGACY_WEEKDAY_KEY);
    if (!legacy || !/^[a-z]{3}$/.test(legacy)) return patterns;
    const next = { ...patterns, weekdayStats: { ...patterns.weekdayStats } };
    const total = WEEK_KEYS.reduce((s, k) => s + (next.weekdayStats[k] ?? 0), 0);
    if (total > 0) return patterns;
    if (WEEK_KEYS.includes(legacy as (typeof WEEK_KEYS)[number])) {
      next.weekdayStats[legacy] = (next.weekdayStats[legacy] ?? 0) + 1;
    }
    return next;
  } catch {
    return patterns;
  }
}

function normalizePatterns(raw: unknown): OrderPatterns {
  if (!raw || typeof raw !== "object") return { ...EMPTY };
  const o = raw as Record<string, unknown>;
  const statsIn = o.weekdayStats && typeof o.weekdayStats === "object" ? (o.weekdayStats as Record<string, unknown>) : {};
  const weekdayStats: Record<string, number> = { ...EMPTY.weekdayStats };
  for (const k of WEEK_KEYS) {
    const n = Number(statsIn[k]);
    weekdayStats[k] = Number.isFinite(n) && n >= 0 ? Math.min(n, 10_000) : 0;
  }
  const lo = Array.isArray(o.lastOrders) ? o.lastOrders.map((x) => String(x).slice(0, 10)).filter(Boolean) : [];
  const lastOrders = [...new Set(lo)].slice(-40);
  const streakCount = Math.min(10_000, Math.max(0, Math.floor(Number(o.streakCount) || 0)));
  const lastStreakWeekStart =
    o.lastStreakWeekStart != null && /^\d{4}-\d{2}-\d{2}$/.test(String(o.lastStreakWeekStart))
      ? String(o.lastStreakWeekStart)
      : null;
  return migrateLegacyWeekday({ weekdayStats, lastOrders, streakCount, lastStreakWeekStart });
}

export function readOrderPatterns(): OrderPatterns {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const s = localStorage.getItem(ORDER_PATTERNS_LS_KEY);
    if (!s) return { ...EMPTY };
    return normalizePatterns(JSON.parse(s) as unknown);
  } catch {
    return { ...EMPTY };
  }
}

export function writeOrderPatterns(p: OrderPatterns) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDER_PATTERNS_LS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function applyStreak(p: OrderPatterns, mondayISO: string): OrderPatterns {
  const prev = p.lastStreakWeekStart;
  if (!prev) {
    return { ...p, streakCount: 1, lastStreakWeekStart: mondayISO };
  }
  if (prev === mondayISO) {
    return p;
  }
  const nextExpected = addDaysISO(prev, 7);
  if (mondayISO === nextExpected) {
    return { ...p, streakCount: Math.min(10_000, p.streakCount + 1), lastStreakWeekStart: mondayISO };
  }
  return { ...p, streakCount: 1, lastStreakWeekStart: mondayISO };
}

/** Etter vellykket bestilling (ACTIVE) — oppdater tellere, streak, siste datoer. */
export function recordSuccessfulOrder(dateISO: string, weekdayKey: string | null): OrderPatterns {
  const p0 = readOrderPatterns();
  const p = {
    ...p0,
    weekdayStats: { ...p0.weekdayStats },
    lastOrders: [...p0.lastOrders],
  };
  const wk = weekdayKey && WEEK_KEYS.includes(weekdayKey as (typeof WEEK_KEYS)[number]) ? weekdayKey : null;
  if (wk) {
    p.weekdayStats[wk] = (p.weekdayStats[wk] ?? 0) + 1;
  }
  const lo = p.lastOrders.filter((x) => x !== dateISO);
  lo.push(dateISO);
  p.lastOrders = lo.slice(-40);
  const mon = mondayISOOsloForCalendarDate(dateISO);
  const next = applyStreak(p, mon);
  writeOrderPatterns(next);
  try {
    if (wk) localStorage.setItem(LEGACY_WEEKDAY_KEY, wk);
  } catch {
    /* ignore */
  }
  return next;
}

export function getWeekdayOrderCount(patterns: OrderPatterns, dateISO: string): number {
  const k = weekdayKeyFromDateISO(dateISO);
  if (!k) return 0;
  return patterns.weekdayStats[k] ?? 0;
}

/** Mest bestilte ukedag (ved likhet: mon→fre). */
export function getTopWeekdayKey(patterns: OrderPatterns): string | null {
  let best: string | null = null;
  let bestN = -1;
  for (const k of WEEK_KEYS) {
    const n = patterns.weekdayStats[k] ?? 0;
    if (n > bestN) {
      bestN = n;
      best = k;
    }
  }
  return bestN > 0 ? best : null;
}

export type DayPick = {
  date: string;
  weekday: string;
  isLocked: boolean;
  isEnabled: boolean;
  orderStatus: "ACTIVE" | "CANCELLED" | null;
};

/** Første kommende dag i vinduet som matcher foretrukket ukedag (kun enabled). */
export function findRecommendedDateInWindow(days: DayPick[], preferredWeekday: string | null): string | null {
  if (!preferredWeekday) return null;
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const hit = sorted.find(
    (d) => String(d.weekday).toLowerCase() === preferredWeekday && d.isEnabled && !d.isLocked,
  );
  return hit?.date ?? null;
}

/**
 * Standardvalg: 1) predikert foretrukket dag i vinduet 2) i dag 3) første åpne.
 * Aldri auto-bestilling — kun hvilket kort som foreslås først.
 */
export function pickDefaultDateFromPatterns(days: DayPick[], patterns: OrderPatterns): string | null {
  if (days.length === 0) return null;
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const pref = getTopWeekdayKey(patterns);
  if (pref) {
    const pred = findRecommendedDateInWindow(sorted, pref);
    if (pred) return pred;
  }
  const today = osloTodayISODate();
  const todayRow = sorted.find((d) => d.date === today);
  if (todayRow && todayRow.isEnabled && !todayRow.isLocked) return todayRow.date;
  const firstOpen = sorted.find((d) => d.isEnabled && !d.isLocked);
  return firstOpen?.date ?? sorted[0]?.date ?? null;
}

export function shouldShowHabitNudge(
  todayRow: DayPick | undefined,
  patterns: OrderPatterns,
  preferredWeekday: string | null,
): boolean {
  if (!todayRow || !todayRow.isEnabled || todayRow.isLocked) return false;
  if (todayRow.orderStatus === "ACTIVE") return false;
  const k = String(todayRow.weekday).toLowerCase();
  const c = patterns.weekdayStats[k] ?? 0;
  if (preferredWeekday && k === preferredWeekday && c >= 1) return true;
  return c >= 2;
}

/** Kl. 07:00–07:59 Oslo — myk påminnelse om frist. */
export function isOsloUrgencyHourBefore0800(): boolean {
  const o = osloNowParts();
  return o.hh === 7;
}

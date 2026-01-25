// lib/agreements/normalize.ts

export type Tier = "BASIS" | "LUXUS";
export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
export type AgreementStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CLOSED";

export const DAY_KEYS: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

/* =========================================================
   Small helpers
========================================================= */

export function safeText(v: any): string | null {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export function isUuid(v: any): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

export function isDayKey(v: any): v is DayKey {
  return typeof v === "string" && (DAY_KEYS as readonly string[]).includes(v);
}

/* =========================================================
   Normalizers
========================================================= */

export function normalizeTier(v: any): Tier {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "LUXUS" ? "LUXUS" : "BASIS";
}

export function normalizeStatus(v: any): AgreementStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "DRAFT" || s === "ACTIVE" || s === "PAUSED" || s === "CLOSED") return s;
  return "DRAFT";
}

/**
 * Accepts:
 * - jsonb array: ["mon","tue",...]
 * - stringified json: '["mon","tue"]'
 * - comma-separated string: "mon,tue,wed"
 * - any -> fallback to Mon–Fri
 */
export function normalizeDeliveryDays(v: any): DayKey[] {
  const fallback: DayKey[] = ["mon", "tue", "wed", "thu", "fri"];

  if (v == null) return fallback.slice();

  // If Supabase returns jsonb as array
  if (Array.isArray(v)) return normalizeDeliveryDaysFromArray(v, fallback);

  // If it’s a string, try JSON first, then CSV
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return fallback.slice();

    // JSON parse
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return normalizeDeliveryDaysFromArray(parsed, fallback);
    } catch {
      // ignore
    }

    // CSV / space separated
    const parts = s
      .split(/[,\s]+/g)
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);

    return normalizeDeliveryDaysFromArray(parts, fallback);
  }

  // If it’s an object with keys (rare): { mon:true, tue:true }
  if (typeof v === "object") {
    const keys = Object.keys(v).map((k) => k.trim().toLowerCase());
    return normalizeDeliveryDaysFromArray(keys, fallback);
  }

  return fallback.slice();
}

function normalizeDeliveryDaysFromArray(arr: any[], fallback: DayKey[]): DayKey[] {
  const out: DayKey[] = [];
  for (const x of arr) {
    const s = String(x ?? "").trim().toLowerCase();
    if ((DAY_KEYS as readonly string[]).includes(s) && !out.includes(s as DayKey)) out.push(s as DayKey);
  }
  return out.length ? out : fallback.slice();
}

/* =========================================================
   Numbers / dates
========================================================= */

export function intOr(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = intOr(v, fallback);
  return Math.max(min, Math.min(max, n));
}

export function isISODate(v: any): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim());
}

export function isoDateOrToday(v: any) {
  const s = String(v ?? "").trim();
  if (isISODate(s)) return s;

  // today UTC YYYY-MM-DD
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

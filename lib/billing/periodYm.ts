import "server-only";

export const PERIOD_YM_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export type PeriodYmBounds = {
  period: string;
  periodStart: string;
  periodEndExclusive: string;
};

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

export function parsePeriodYm(value: unknown): string | null {
  const s = safeStr(value);
  if (!PERIOD_YM_RE.test(s)) return null;
  return s;
}

export function toPeriodYmBounds(periodInput: unknown): PeriodYmBounds | null {
  const period = parsePeriodYm(periodInput);
  if (!period) return null;

  const [yearRaw, monthRaw] = period.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;

  const periodStart = `${period}-01`;
  const nextMonthStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);

  return {
    period,
    periodStart,
    periodEndExclusive: nextMonthStart,
  };
}

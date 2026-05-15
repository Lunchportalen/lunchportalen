import "server-only";

import { isIsoDate, osloNowParts } from "@/lib/date/oslo";

export type CompanyDashboardPeriod = { start: string; end: string };

function defaultMonthRangeOslo(): CompanyDashboardPeriod {
  const o = osloNowParts();
  const y = Number(o.yyyy);
  const m = Number(o.mm);
  const start = `${o.yyyy}-${o.mm}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${o.yyyy}-${o.mm}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export function resolveCompanyDashboardPeriod(searchParams: { start?: string; end?: string }): CompanyDashboardPeriod {
  let start = safeStr(searchParams?.start);
  let end = safeStr(searchParams?.end);

  if (!start || !end) {
    const d = defaultMonthRangeOslo();
    if (!start) start = d.start;
    if (!end) end = d.end;
  }

  if (!isIsoDate(start) || !isIsoDate(end)) {
    throw new Error("INVALID_PERIOD");
  }
  if (end < start) {
    throw new Error("INVALID_PERIOD_RANGE");
  }

  const span =
    (new Date(`${end}T12:00:00Z`).getTime() - new Date(`${start}T12:00:00Z`).getTime()) / (86400 * 1000);
  if (span > 731) {
    throw new Error("PERIOD_TOO_LONG");
  }

  return { start, end };
}

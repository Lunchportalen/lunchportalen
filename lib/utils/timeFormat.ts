/**
 * Human-friendly Norwegian time strings for CMS history (deterministic: same inputs + reference date → same output).
 */

const MS_PER_DAY = 86_400_000;

export function startOfLocalDay(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

function calendarDaysBetweenEarlierAndLater(earlier: Date, later: Date): number {
  const a = startOfLocalDay(earlier).getTime();
  const b = startOfLocalDay(later).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * @param date ISO string or Date
 * @param referenceDate calendar "today" for grouping (defaults to runtime now)
 */
export function formatHumanTime(date: string | Date, referenceDate: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) {
    return typeof date === "string" ? date : "";
  }
  const ref = referenceDate;
  const diffFromVersionToRef = calendarDaysBetweenEarlierAndLater(d, ref);
  const time = d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });

  if (diffFromVersionToRef === 0) return `i dag ${time}`;
  if (diffFromVersionToRef === 1) return `i går ${time}`;
  if (diffFromVersionToRef >= 2 && diffFromVersionToRef <= 6) {
    return `for ${diffFromVersionToRef} dager siden · ${time}`;
  }
  return d.toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
}

export type GroupedVersions<T> = { today: T[]; yesterday: T[]; older: T[] };

/**
 * Groups by local calendar day vs referenceDate (deterministic for same reference).
 */
export function groupVersions<T extends { createdAt: string }>(
  versions: T[],
  referenceDate: Date = new Date()
): GroupedVersions<T> {
  const result: GroupedVersions<T> = { today: [], yesterday: [], older: [] };
  const ref = referenceDate;

  for (const v of versions) {
    const d = new Date(v.createdAt);
    if (Number.isNaN(d.getTime())) {
      result.older.push(v);
      continue;
    }
    const diff = calendarDaysBetweenEarlierAndLater(d, ref);
    if (diff === 0) result.today.push(v);
    else if (diff === 1) result.yesterday.push(v);
    else result.older.push(v);
  }

  return result;
}

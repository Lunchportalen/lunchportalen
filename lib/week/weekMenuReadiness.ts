import { startOfWeekISO } from "@/lib/date/oslo";

export type WeekMenuReadinessDay = {
  date: string;
  categories: unknown[];
  reason?: string | null;
  isEnabled?: boolean;
};

/**
 * Fail-closed: uken er synlig for ansatt, men ingen dag har publisert meny ennå.
 * Brukes for «Kommer snart» — ikke for Sanity-feil eller NO_TIER.
 */
export function isWeekMenuComingSoon(
  days: ReadonlyArray<WeekMenuReadinessDay>,
  weekStart: string,
): boolean {
  const weekDays = days.filter((d) => startOfWeekISO(d.date) === weekStart);
  if (weekDays.length === 0) return false;

  const relevant = weekDays.filter(
    (d) => d.reason !== "NO_TIER_FOR_DAY" && d.isEnabled !== false,
  );
  if (relevant.length === 0) return false;

  return relevant.every(
    (d) => !Array.isArray(d.categories) || d.categories.length === 0,
  );
}

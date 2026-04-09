/**
 * Oslo wall date (YYYY-MM-DD) → mon–fri key. Weekend → null.
 */
export type WeekdayKeyMonFri = "mon" | "tue" | "wed" | "thu" | "fri";

export function weekdayKeyFromOsloISODate(isoDate: string): WeekdayKeyMonFri | null {
  const d = new Date(`${isoDate}T12:00:00+01:00`);
  const dow = d.getDay();
  const map: Record<number, WeekdayKeyMonFri> = {
    1: "mon",
    2: "tue",
    3: "wed",
    4: "thu",
    5: "fri",
  };
  return map[dow] ?? null;
}

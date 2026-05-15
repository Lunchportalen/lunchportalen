import { OSLO_TZ, addDaysISO, startOfWeekISO } from "@/lib/date/oslo";

/**
 * ISO calendar date (YYYY-MM-DD) for an instant, in Europe/Oslo.
 */
export function utcInstantToOsloDateISO(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Monday (ISO) of the week that is 3 weeks after the week containing osloTodayISO. */
export function startOfWeekMondayNPlus3(osloTodayISO: string): string {
  const thisMonday = startOfWeekISO(osloTodayISO);
  return addDaysISO(thisMonday, 21);
}

/** Weekday ISO dates Mon–Fri from Monday ISO. */
export function mondayToFridayIso(mondayISO: string): string[] {
  return [0, 1, 2, 3, 4].map((i) => addDaysISO(mondayISO, i));
}

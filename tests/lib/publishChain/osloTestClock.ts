import { addDaysISO, startOfWeekISO } from "@/lib/date/oslo";
import { startOfWeekMondayNPlus3, utcInstantToOsloDateISO } from "@/lib/menu-publish/calendar";

/**
 * Deterministic Europe/Oslo wall-clock instants for publish-chain integration tests.
 * Prefer explicit offset (+01:00 CET / +02:00 CEST) over guessing UTC.
 */
export function osloWallInstant(
  isoDate: string,
  hour: number,
  minute: number,
  offset: "+01:00" | "+02:00" = "+01:00",
): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  const [y, mo, d] = isoDate.split("-");
  return new Date(`${y}-${pad(Number(mo))}-${pad(Number(d))}T${pad(hour)}:${pad(minute)}:00${offset}`);
}

/** Third-week Monday visible to employees from opening Thursday 14:00 (pure calendar). */
export function thirdWeekMondayFromOpeningThursday(thursdayIso: string): string {
  return addDaysISO(startOfWeekISO(thursdayIso), 14);
}

/** Rollout target Monday (N+3) from rollout Thursday ISO date in Oslo. */
export function rolloutTargetFromRolloutThursday(thursdayIso: string): string {
  return startOfWeekMondayNPlus3(thursdayIso);
}

/** Rollout target from rollout instant (UTC-safe via Oslo date). */
export function rolloutTargetFromRolloutInstant(instant: Date): string {
  return startOfWeekMondayNPlus3(utcInstantToOsloDateISO(instant));
}

/** Third-week Monday from opening instant at Thu 14:00+ (Oslo date of instant). */
export function thirdWeekMondayFromOpeningInstant(instant: Date): string {
  return thirdWeekMondayFromOpeningThursday(utcInstantToOsloDateISO(instant));
}

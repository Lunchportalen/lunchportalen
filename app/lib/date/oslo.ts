export const OSLO_TZ = "Europe/Oslo";

export function osloNow(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: OSLO_TZ }));
}

export function osloTodayISO(now: Date = osloNow()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

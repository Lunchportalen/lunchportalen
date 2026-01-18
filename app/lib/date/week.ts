// lib/date/week.ts

const OSLO_TZ = "Europe/Oslo";

/**
 * Formatterer en Date som YYYY-MM-DD i Oslo-tid.
 * Bruker sv-SE for stabil "YYYY-MM-DD" output.
 */
export function formatOsloISO(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;

  if (!y || !m || !d) {
    throw new Error("[formatOsloISO] Failed to format date in Oslo timezone");
  }

  return `${y}-${m}-${d}`;
}

/**
 * Gir "nå" som Date tolket i Oslo-tid (uten å endre faktisk timezone i JS).
 * Dette er en praktisk helper for å bruke getDay()/setDate() konsistent.
 */
function osloNowDate(base: Date = new Date()): Date {
  return new Date(base.toLocaleString("en-US", { timeZone: OSLO_TZ }));
}

/**
 * Start på uke (mandag) i Oslo → YYYY-MM-DD
 */
export function startOfWeekISO(date: Date = new Date()): string {
  const osloNow = osloNowDate(date);

  // JS: 0=Sun..6=Sat → gjør Monday=0
  const dayIndexMon0 = (osloNow.getDay() + 6) % 7;

  const start = new Date(osloNow);
  start.setHours(12, 0, 0, 0); // midt på dagen = DST-safe
  start.setDate(osloNow.getDate() - dayIndexMon0);

  return formatOsloISO(start);
}

/**
 * Ukedager (Man–Fre) i Oslo for valgt ukeoffset.
 * weekOffset = 0 => inneværende uke
 * weekOffset = 1 => neste uke
 * weekOffset = -1 => forrige uke
 */
export function weekRangeISO(weekOffset: number = 0): string[] {
  const startISO = startOfWeekISO();
  const start = new Date(`${startISO}T12:00:00`); // DST-safe (midt på dagen)
  start.setDate(start.getDate() + weekOffset * 7);

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return formatOsloISO(d);
  });
}

/**
 * Samme som weekRangeISO, men lar deg velge en "anchor" dato (YYYY-MM-DD).
 * Brukes når du vil vise uken til en konkret dato.
 */
export function weekRangeISOFrom(anchorISO: string, weekOffset: number = 0): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorISO)) {
    throw new Error(
      `[weekRangeISOFrom] Invalid anchor date (expected YYYY-MM-DD): ${anchorISO}`
    );
  }

  const anchor = new Date(`${anchorISO}T12:00:00`);
  const startISO = startOfWeekISO(anchor);
  const start = new Date(`${startISO}T12:00:00`);
  start.setDate(start.getDate() + weekOffset * 7);

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return formatOsloISO(d);
  });
}

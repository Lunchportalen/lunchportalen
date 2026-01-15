// app/lib/date/week.ts

const OSLO_TZ = "Europe/Oslo";

// Hjelper: formatterer dato i Oslo som YYYY-MM-DD
function formatOsloISO(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

// Start på uke (mandag) i Oslo → YYYY-MM-DD
function startOfWeekISO(date = new Date()): string {
  // Lag "nå" i Oslo
  const osloNow = new Date(
    date.toLocaleString("en-US", { timeZone: OSLO_TZ })
  );

  // JS: 0=Sun..6=Sat → gjør Monday=0
  const day = (osloNow.getDay() + 6) % 7;

  const start = new Date(osloNow);
  start.setDate(osloNow.getDate() - day);

  return formatOsloISO(start);
}

// Ukedager (Man–Fre) i Oslo for valgt uke
export function weekRangeISO(weekOffset = 0): string[] {
  const start = new Date(`${startOfWeekISO()}T12:00:00`);
  start.setDate(start.getDate() + weekOffset * 7);

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return formatOsloISO(d);
  });
}

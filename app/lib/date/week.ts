import { OSLO_TZ } from "./oslo";

function startOfWeekISO(date = new Date()): string {
  const d = new Date(
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: OSLO_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date)
  );

  const day = d.getDay() || 7; // søndag=0 -> 7
  if (day !== 1) d.setDate(d.getDate() - (day - 1)); // mandag
  return d.toISOString().slice(0, 10);
}

export function weekRangeISO(weekOffset = 0) {
  const start = new Date(startOfWeekISO());
  start.setDate(start.getDate() + weekOffset * 7);

  const days = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return days; // [YYYY-MM-DD x 5]
}

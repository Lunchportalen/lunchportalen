/** Måned start (YYYY-MM-01) i Europe/Oslo — brukt av ESG-snapshot-spørringer. */
export function isoMonthStartOslo(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = fmt.format(d);
  return today.slice(0, 8) + "01";
}

export function addMonthsIso(isoMonth01: string, delta: number): string {
  const [y, m] = isoMonth01.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

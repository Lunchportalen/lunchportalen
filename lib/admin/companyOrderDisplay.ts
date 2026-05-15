import "server-only";

const nok0 = new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 });

export function formatNokFromCents(cents: number): string {
  if (!Number.isFinite(cents)) return nok0.format(0);
  return nok0.format(Math.round(cents) / 100);
}

/** ISO YYYY-MM-DD → dd.mm.yyyy */
function isoToDisplayNo(iso: string): string {
  const s = String(iso ?? "").trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function formatCompanyDashboardPeriodLabel(startIso: string, endIso: string): string {
  return `${isoToDisplayNo(startIso)}–${isoToDisplayNo(endIso)}`;
}

export function fmtNok(n: any) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(v);
}
export function fmtNum(n: any, digits = 0) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("nb-NO", { maximumFractionDigits: digits }).format(v);
}
export function fmtKg(n: any) {
  const v = Number(n ?? 0);
  return `${fmtNum(v, 1)} kg`;
}
export function fmtCo2e(n: any) {
  const v = Number(n ?? 0);
  return `${fmtNum(v, 1)} kg CO₂e`;
}
export function fmtMonthLabel(isoMonth01: string) {
  // YYYY-MM-01 -> "jan 2026"
  try {
    const d = new Date(isoMonth01 + "T00:00:00Z");
    return d.toLocaleDateString("nb-NO", { month: "short", year: "numeric" });
  } catch {
    return isoMonth01;
  }
}

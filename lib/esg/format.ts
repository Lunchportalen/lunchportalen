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
import { formatMonthYearShortNO } from "@/lib/date/format";

export function fmtMonthLabel(isoMonth01: string) {
  // YYYY-MM-01 -> "jan 2026"
  return formatMonthYearShortNO(isoMonth01);
}

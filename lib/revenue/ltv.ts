/**
 * Forenklet LTV — krever gyldig månedlig churn i (0,1).
 */
export function calculateLTV(arpu: number, churn: number): number | null {
  const a = Number.isFinite(arpu) ? arpu : 0;
  const ch = Number.isFinite(churn) ? churn : 0;
  if (ch <= 0 || ch >= 1) return null;
  return a * (1 / ch);
}

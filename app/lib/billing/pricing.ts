// lib/billing/pricing.ts
export type PlanTier = "BASIS" | "LUXUS";

export function unitPriceNOK(tier: PlanTier) {
  return tier === "LUXUS" ? 130 : 90;
}

export function safeTier(v: any): PlanTier {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "LUXUS" ? "LUXUS" : "BASIS";
}

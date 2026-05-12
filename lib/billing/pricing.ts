// lib/billing/pricing.ts
export type PlanTier = "BASIS" | "LUXUS" | "ENTERPRISE";

export function unitPriceNOK(tier: PlanTier) {
  if (tier === "ENTERPRISE") return 170;
  return tier === "LUXUS" ? 130 : 90;
}

export function safeTier(v: any): PlanTier {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ENTERPRISE") return "ENTERPRISE";
  return s === "LUXUS" ? "LUXUS" : "BASIS";
}

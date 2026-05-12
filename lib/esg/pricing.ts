// STATUS: KEEP

export type PlanTier = "BASIS" | "LUXUS" | "ENTERPRISE";

export function priceForTierNok(tier: PlanTier): number {
  if (tier === "ENTERPRISE") return 170;
  return tier === "LUXUS" ? 130 : 90;
}

/**
 * Hvis dere senere får variable priser per avtale:
 * - legg inn avtaleoverstyring her
 * - behold fallback til tier-pris
 */
export function resolveMealPriceNok(args: {
  tier: PlanTier;
  agreementPriceNok?: number | null;
}): number {
  const p = typeof args.agreementPriceNok === "number" && args.agreementPriceNok > 0 ? args.agreementPriceNok : null;
  return p ?? priceForTierNok(args.tier);
}

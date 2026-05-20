// STATUS: KEEP
// Patch 2.1 / MP3: Enterprise agreement tier = Luxus + premium varmrett (ikke egen billing/CMS-plan).

export type PlanTier = "BASIS" | "LUXUS" | "ENTERPRISE";

export type OperationalPlanTier = "BASIS" | "LUXUS";

/**
 * Billing/CMS operational tier: ENTERPRISE maps to LUXUS (no separate product row in billing_products).
 */
export function operationalPlanTier(tier: PlanTier): OperationalPlanTier {
  return tier === "ENTERPRISE" ? "LUXUS" : tier;
}

export function priceForTierNok(tier: PlanTier): number {
  return operationalPlanTier(tier) === "LUXUS" ? 130 : 90;
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

export type DynamicPriceContext = {
  demand?: number;
  userIntent?: "high_intent" | "medium_intent" | "low_intent";
  market?: "high_income" | "default";
};

/**
 * Deterministic multiplier rules (audit-friendly). No auto-ledger writes.
 */
export function dynamicPrice(basePrice: number, context: DynamicPriceContext): number {
  let multiplier = 1;
  const d = typeof context.demand === "number" && Number.isFinite(context.demand) ? context.demand : 0;
  if (d > 0.8) multiplier += 0.1;
  if (context.userIntent === "high_intent") multiplier += 0.05;
  if (context.market === "high_income") multiplier += 0.1;
  const b = typeof basePrice === "number" && Number.isFinite(basePrice) && basePrice >= 0 ? basePrice : 0;
  return Math.round(b * multiplier);
}

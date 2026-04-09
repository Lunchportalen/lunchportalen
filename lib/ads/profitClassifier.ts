/**
 * Profit-klassifisering: sterk / svak / tap.
 */

import { calculateMargin, calculateProfit, type ProfitInput } from "@/lib/ads/profit";

export type ProfitStrengthClass = "strong" | "weak" | "loss";

export function classifyProfit(campaign: ProfitInput): ProfitStrengthClass {
  const profit = calculateProfit(campaign);
  const margin = calculateMargin(campaign);

  if (profit > 0 && margin > 0.4) return "strong";
  if (profit > 0) return "weak";

  return "loss";
}

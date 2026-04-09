/**
 * Autonom beslutning ut fra profit-klasse — vekst kun når klassifisert sterk.
 */

import { classifyProfit, type ProfitStrengthClass } from "@/lib/ads/profitClassifier";
import type { ProfitInput } from "@/lib/ads/profit";

export type AutonomyProfitAction = "scale" | "hold" | "cut";

export function decideAction(campaign: ProfitInput): AutonomyProfitAction {
  const profitClass: ProfitStrengthClass = classifyProfit(campaign);
  if (profitClass === "strong") {
    return "scale";
  }
  if (profitClass === "weak") {
    return "hold";
  }
  return "cut";
}

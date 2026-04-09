/**
 * Hard grense for budsjett (kapitalbeskyttelse).
 */

import { budgetRules } from "@/lib/ads/rules";

export function clamp(value: number): number {
  if (value < budgetRules.minBudget) return budgetRules.minBudget;
  if (value > budgetRules.maxBudget) return budgetRules.maxBudget;
  return value;
}

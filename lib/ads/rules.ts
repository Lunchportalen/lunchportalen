/**
 * Globale budsjett-guardrails — én sannhet for UI og motor.
 */

export const budgetRules = {
  maxDailyIncrease: 0.3,
  maxDailyDecrease: 0.2,
  minBudget: 50,
  maxBudget: 10000,
} as const;

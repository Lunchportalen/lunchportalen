/**
 * Global kontroll på kontonivå (aggregert spend) + portfolio ROAS-policy (additive).
 */

import { guardrails } from "@/lib/ads/guardrails";

export type AccountControlStatus = "ok" | "freeze_all";

export type PortfolioRoasPolicy =
  | { mode: "reduce_all"; factor: number }
  | { mode: "scale_allowed" }
  | { mode: "maintain" };

export function controlAccount(campaigns: Array<{ spend: number }>): AccountControlStatus {
  const totalSpend = campaigns.reduce((s, c) => s + Math.max(0, c.spend), 0);
  if (totalSpend > guardrails.maxAccountBudget) {
    return "freeze_all";
  }
  return "ok";
}

/**
 * Portefølje-ROAS: under 1,5 → reduser alle (faktor); over 3 → tillat aggressiv multi-account skalering i planlegger.
 * Ugyldig ROAS → maintain (fail-closed, ingen aggressiv skalering).
 */
export function portfolioRoasPolicy(portfolioRoas: number): PortfolioRoasPolicy {
  if (!Number.isFinite(portfolioRoas) || portfolioRoas < 0) {
    return { mode: "maintain" };
  }
  if (portfolioRoas < guardrails.portfolioRoasReduceAllBelow) {
    return { mode: "reduce_all", factor: 0.85 };
  }
  if (portfolioRoas > guardrails.portfolioRoasAllowAggressiveScaleAbove) {
    return { mode: "scale_allowed" };
  }
  return { mode: "maintain" };
}

export function resolveAccountControlState(
  campaigns: Array<{ spend: number }>,
  portfolioRoas: number,
): {
  spendStatus: AccountControlStatus;
  portfolioPolicy: PortfolioRoasPolicy;
} {
  return {
    spendStatus: controlAccount(campaigns),
    portfolioPolicy: portfolioRoasPolicy(portfolioRoas),
  };
}

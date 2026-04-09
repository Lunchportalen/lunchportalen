/**
 * Global portefølje-sikkerhet (ROAS under terskel → fryse alt i planleggeren).
 */

import { guardrails } from "@/lib/ads/guardrails";

export type GlobalSafetyStatus = "freeze_all" | "ok";

export function globalSafety(portfolio: { roas: number }): GlobalSafetyStatus {
  const r = portfolio.roas;
  if (!Number.isFinite(r) || r < 0) return "freeze_all";
  if (r < guardrails.portfolioRoasReduceAllBelow) return "freeze_all";
  return "ok";
}

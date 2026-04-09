/**
 * STEP 7 — Revenue optimization safety (analysis vs execution).
 */

import type { RevenueAction } from "./decisionEngine";

export const REVENUE_MAX_ACTIONS_PER_RUN = 2;

/** Cooldown between revenue-impacting applies (ms). */
export const REVENUE_ACTION_COOLDOWN_MS = 300_000;

export type RevenueOptimizationConfig = {
  autoOptimize: boolean;
};

export const DEFAULT_REVENUE_CONFIG: RevenueOptimizationConfig = {
  autoOptimize: false,
};

export function capRevenueActions(actions: RevenueAction[], max: number = REVENUE_MAX_ACTIONS_PER_RUN): RevenueAction[] {
  if (max <= 0) return [];
  return actions.slice(0, max);
}

export type LastRevenueApplySnapshot = {
  at: number;
  targets: string[];
};

export function assertRevenueCooldown(
  newTargets: string[],
  last: LastRevenueApplySnapshot | null | undefined,
  cooldownMs: number = REVENUE_ACTION_COOLDOWN_MS,
): { ok: true } | { ok: false; message: string } {
  if (!last || last.targets.length === 0 || newTargets.length === 0) return { ok: true };
  const overlap = newTargets.some((t) => last.targets.includes(t));
  if (!overlap) return { ok: true };
  const elapsed = Date.now() - last.at;
  if (elapsed >= cooldownMs) return { ok: true };
  return {
    ok: false,
    message: `Cooldown aktiv (${Math.ceil((cooldownMs - elapsed) / 1000)}s) for overlappende mål.`,
  };
}

/**
 * Rollback recommendation: fail-closed if new rate is materially worse.
 */
export function shouldRecommendRollback(params: {
  metricBefore: number | null;
  metricAfter: number | null;
  minRelativeLift: number;
}): { rollback: boolean; reason: string } {
  const { metricBefore, metricAfter, minRelativeLift } = params;
  if (metricBefore == null || metricAfter == null) {
    return { rollback: false, reason: "Mangler før/etter-metrikk — ingen automatisk rollback-beslutning." };
  }
  if (metricBefore <= 0) {
    return { rollback: false, reason: "Null baseline — sammenlign ikke relativt." };
  }
  const ratio = metricAfter / metricBefore;
  if (ratio < 1 - minRelativeLift) {
    return {
      rollback: true,
      reason: `Etter-måling ${(ratio * 100).toFixed(1)}% av før — under terskel (-${(minRelativeLift * 100).toFixed(0)}%).`,
    };
  }
  return { rollback: false, reason: "Ytelse innenfor akseptabelt intervall." };
}

/** SAFE auto-apply: design tokens only, conservative list. */
export function filterActionsForAutoOptimize(actions: RevenueAction[]): RevenueAction[] {
  return actions.filter((a) => a.type === "design" && (a.target === "spacing.section" || a.target === "card.cta.hover"));
}

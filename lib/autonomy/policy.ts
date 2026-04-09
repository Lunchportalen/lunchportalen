import type { SystemToggles } from "@/lib/system/settings";

import type { AutonomyConfigResolved } from "./config";
import type { MappedActionType, MappedAutonomyAction } from "./types";

export type PolicyResult = { ok: true } | { ok: false; reason: string };

/** Policy for «forretningsmotor»-lag (ikke samme som RC `AutonomyConfigResolved`). */
export type ResolvedAutonomyPolicy = {
  enabled: boolean;
  maxActionsPerDay: number;
  maxDailyAdSpend: number;
  maxTotalAdSpend: number;
  minROAS: number;
  minMargin: number;
  maxPriceChange: number;
  maxProcurementCost: number;
  allowAutoAds: boolean;
  allowAutoPricing: boolean;
  allowAutoProcurement: boolean;
};

export const autonomyPolicy: ResolvedAutonomyPolicy = {
  enabled: false,
  maxActionsPerDay: 10,
  maxDailyAdSpend: 4800,
  maxTotalAdSpend: 20000,
  minROAS: 2,
  minMargin: 0.1,
  maxPriceChange: 0.15,
  maxProcurementCost: 20000,
  allowAutoAds: false,
  allowAutoPricing: false,
  allowAutoProcurement: false,
};

export function resolveAutonomyPolicy(toggles: SystemToggles): ResolvedAutonomyPolicy {
  const master = toggles.autonomy_master_enabled === true;
  return {
    enabled: master,
    maxActionsPerDay: 10,
    maxDailyAdSpend: 4800,
    maxTotalAdSpend: 20000,
    minROAS: 2,
    minMargin: 0.1,
    maxPriceChange: 0.15,
    maxProcurementCost: 20000,
    allowAutoAds: master && toggles.autonomy_allow_auto_ads === true,
    allowAutoPricing: master && toggles.autonomy_allow_auto_pricing === true,
    allowAutoProcurement: master && toggles.autonomy_allow_auto_procurement === true,
  };
}

/**
 * Risky actions need explicit approval in request; safe actions (retry_jobs, observe) follow allow-list.
 */
export function canExecute(
  action: MappedAutonomyAction,
  config: AutonomyConfigResolved,
  approved: ReadonlySet<MappedActionType>
): PolicyResult {
  if (!config.enabled) {
    return { ok: false, reason: "kill_switch" };
  }

  const allow = config.allow as Record<string, boolean>;
  if (allow[action.type] !== true) {
    return { ok: false, reason: "policy_denied" };
  }

  if (action.requiresApproval && !approved.has(action.type)) {
    return { ok: false, reason: "approval_required" };
  }

  return { ok: true };
}

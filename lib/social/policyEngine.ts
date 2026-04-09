/**
 * Policy for autonom SoMe-motor — eksplisitte flagg, fail-closed.
 */

import type { Decision, RiskLevel } from "@/lib/social/decisionEngine";

const RISK_RANK: Record<RiskLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export const policy = {
  autoGenerate: true,
  autoSchedule: true,
  autoOptimize: true,
  autoPromote: true,
  /** HARD LOCK: ingen ekstern auto-publisering uten eksplisitt driftssignal. */
  autoPublish: false,
  minConfidence: 0.75,
  maxActionsPerRun: 3,
  /** Beslutninger med høyere risiko enn dette avvises (publish er «high» og låst). */
  maxRiskLevel: "medium" as RiskLevel,
  /** Standard terskel for prognose-hook (forventet effekt); kan overstyres per kjøring. */
  minExpectedImpact: 0.35,
  /** Maks forsterknings-skaleringshandlinger (boost + repliker vinner) per syklus. */
  maxScalingPerRun: 2,
  /** Maks deprioriteringer per syklus (undertrykk taper). */
  maxSuppressionPerRun: 2,
  autoDeprioritize: true,
} as const;

/**
 * Returnerer true kun når beslutningen er tillatt under gjeldende policy (ingen kjøring her).
 */
export function isAllowed(decision: Decision): boolean {
  if (decision.confidence < policy.minConfidence) return false;
  if (RISK_RANK[decision.riskLevel] > RISK_RANK[policy.maxRiskLevel]) return false;
  if (decision.type === "publish" && !policy.autoPublish) return false;
  if (!policy.autoGenerate && (decision.type === "generate" || decision.type === "generate_post")) return false;
  if (!policy.autoSchedule && (decision.type === "schedule" || decision.type === "schedule_post")) return false;
  if (!policy.autoOptimize && decision.type === "adjust_timing") return false;
  if (
    !policy.autoPromote &&
    (decision.type === "promote" || decision.type === "promote_product" || decision.type === "boost_existing")
  ) {
    return false;
  }
  if (!policy.autoDeprioritize && decision.type === "deprioritize") return false;
  return true;
}

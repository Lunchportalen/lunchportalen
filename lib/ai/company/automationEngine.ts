/**
 * STEP 3 — Orchestration: decision → policy → execution plan (execution itself stays in API).
 */

import "server-only";

import type { DesignSettingsDocument } from "@/lib/cms/design/designContract";
import { opsLog } from "@/lib/ops/log";

import { resolveAllowedCompanyAction } from "./actionTypes";
import { detectCompanyAnomalies } from "./anomaly";
import {
  assertCompanyBatchCooldown,
  capCompanyDecisions,
  COMPANY_MAX_DECISIONS_PER_RUN,
  detectSpacingConflictDeniedIds,
  evaluateCompanyDecision,
  isAutoSafeDecision,
} from "./policyEngine";
import { proposeCompanyDecisions } from "./decisionEngine";
import { evaluateCompanySafety } from "./safety";
import type { CompanyAnomaly } from "./anomaly";
import type { CompanySafetyVerdict } from "./safety";
import type {
  CompanyAutomationExecutable,
  CompanyAutomationQueuedItem,
  CompanyBatchCooldownResult,
  CompanyDecision,
  CompanyExecutionMode,
  CompanyPolicyContext,
  CompanyPolicyDecisionLogEntry,
  CompanyPolicyResult,
  CompanySnapshot,
} from "./types";

export type CompanyControlCycleResult = {
  rid: string;
  collectedAt: string;
  mode: CompanyExecutionMode;
  anomalies: CompanyAnomaly[];
  safety: CompanySafetyVerdict;
  decisions: CompanyDecision[];
  evaluations: Array<{ decision: CompanyDecision; policy: CompanyPolicyResult }>;
  autoExecutable: CompanyAutomationExecutable[];
  queuedForApproval: Array<{ decision: CompanyDecision; policy: CompanyPolicyResult }>;
  batchCooldown: CompanyBatchCooldownResult;
  policyDecisionLog: CompanyPolicyDecisionLogEntry[];
  logSummary: string;
};

export function companyDecisionToSafeDesignPatch(d: CompanyDecision): DesignSettingsDocument | null {
  if (!isAutoSafeDecision(d)) return null;
  const a = d.action.toLowerCase();
  if (a.includes("spacing") || a.includes("vertical") || a.includes("tight")) {
    return { spacing: { section: "wide" } };
  }
  if (a.includes("cta") || a.includes("hover") || a.includes("visibility")) {
    return { card: { cta: { hover: "lift" } } };
  }
  return null;
}

export function runCompanyControlCycle(input: {
  snapshot: CompanySnapshot;
  mode: CompanyExecutionMode;
  lastBatch?: { at: number; decisionIds: string[] } | null;
  targetCooldownLastAt?: Record<string, number> | null;
  negativeImpactObserved?: boolean;
}): CompanyControlCycleResult {
  const { snapshot, mode } = input;
  const anomalies = detectCompanyAnomalies(snapshot);
  const safety = evaluateCompanySafety({ mode, anomalies });

  if (anomalies.length > 0 && mode === "auto") {
    opsLog("company_control.anomaly_hard_stop_auto", {
      rid: snapshot.rid,
      kinds: anomalies.map((a) => a.kind).join(","),
    });
  }
  const raw = proposeCompanyDecisions(snapshot);
  const decisions = capCompanyDecisions(raw, COMPANY_MAX_DECISIONS_PER_RUN);
  const ids = decisions.map((d) => d.id);
  const batchCooldown = assertCompanyBatchCooldown(ids, input.lastBatch ?? null);
  const conflictDeny = detectSpacingConflictDeniedIds(decisions);

  const negativeImpactObserved =
    input.negativeImpactObserved === true ||
    anomalies.some((a) => a.kind === "revenue_drop") ||
    safety.alertLevel === "critical";

  const policyCtx: CompanyPolicyContext = {
    mode,
    lastAutopilotAt: input.lastBatch?.at,
    targetCooldownLastAt: input.targetCooldownLastAt ?? null,
    negativeImpactObserved,
    hasAnomalies: anomalies.length > 0,
  };

  const evaluations: CompanyControlCycleResult["evaluations"] = [];
  const autoExecutable: CompanyAutomationExecutable[] = [];
  const queuedForApproval: CompanyAutomationQueuedItem[] = [];
  const policyDecisionLog: CompanyPolicyDecisionLogEntry[] = [];

  for (const decision of decisions) {
    let policy = evaluateCompanyDecision(decision, policyCtx);

    if (conflictDeny.has(decision.id)) {
      policy = {
        allowed: false,
        reason: "spacing_conflict_same_cycle",
        riskLevel: decision.risk,
        allowedAction: resolveAllowedCompanyAction(decision),
      };
    }

    if (!batchCooldown.allowed) {
      policy = {
        allowed: false,
        reason: `batch:${batchCooldown.reason}`,
        riskLevel: decision.risk,
        allowedAction: resolveAllowedCompanyAction(decision),
      };
    }

    if (!safety.autopilotAllowed && mode === "auto") {
      policy = {
        allowed: false,
        reason: `safety:${safety.alertLevel}`,
        riskLevel: decision.risk,
        allowedAction: resolveAllowedCompanyAction(decision),
      };
    }

    evaluations.push({ decision, policy });

    policyDecisionLog.push({
      decisionId: decision.id,
      allowedAction: policy.allowedAction,
      allowed: policy.allowed,
      reason: policy.reason,
      riskLevel: policy.riskLevel,
      mode,
      override: policy.override,
    });

    const patch = companyDecisionToSafeDesignPatch(decision);

    if (mode === "auto" && policy.allowed && safety.autopilotAllowed && patch) {
      autoExecutable.push({ decision, policy, designPatch: patch });
    } else {
      queuedForApproval.push({ decision, policy });
    }
  }

  const logSummary = [
    `mode=${mode}`,
    `decisions=${decisions.length}`,
    `autoExecutable=${autoExecutable.length}`,
    `queued=${queuedForApproval.length}`,
    `safety=${safety.alertLevel}`,
  ].join("; ");

  return {
    rid: snapshot.rid,
    collectedAt: snapshot.collectedAt,
    mode,
    anomalies,
    safety,
    decisions,
    evaluations,
    autoExecutable,
    queuedForApproval,
    batchCooldown,
    policyDecisionLog,
    logSummary,
  };
}

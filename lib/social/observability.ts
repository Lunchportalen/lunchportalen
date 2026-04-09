/**
 * Observabilitet for autonom SoMe-motor — konsoll + ai_activity_log (best-effort).
 */

import "server-only";

import { logAiExecution } from "@/lib/ai/logging/aiExecutionLog";
import type { Decision } from "@/lib/social/decisionEngine";

function truncateJson(v: unknown, max = 2500): string {
  try {
    const s = JSON.stringify(v);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return String(v);
  }
}

function decisionSummary(d: Decision): Record<string, unknown> {
  return {
    id: d.id,
    type: d.type,
    reason: d.reason,
    confidence: d.confidence,
    expectedImpact: d.expectedImpact ?? null,
    riskLevel: d.riskLevel,
    timestamp: d.timestamp,
    approved: d.approved,
    executed: d.executed,
    skipReason: d.skipReason ?? null,
    data: d.data,
  };
}

/** Full beslutning logges (forkortet JSON i metadata for store payloads). */
export function logDecisionRecord(
  actorUserId: string | null,
  decision: Decision,
  phase: "executed" | "skipped" | "reverted",
  extra?: Record<string, unknown>,
): void {
  const payload = { phase, decision: decisionSummary(decision), ...extra };
  console.log("[AI_SOCIAL_DECISION]", truncateJson(payload, 4000));
  void logAiExecution({
    capability: "social_engine_autonomy_decision",
    resultStatus: phase === "executed" ? "success" : phase === "reverted" ? "success" : "failure",
    userId: actorUserId,
    metadata: {
      ...payload,
      decisionJson: truncateJson(decisionSummary(decision)),
    },
  });
}

export function logDecisionSkipped(actorUserId: string | null, decision: Decision, reason: string): void {
  logDecisionRecord(actorUserId, decision, "skipped", { reason });
}

export function logDecisionExecuted(
  actorUserId: string | null,
  decision: Decision,
  metadata?: Record<string, unknown>,
): void {
  logDecisionRecord(actorUserId, decision, "executed", metadata);
}

export function logDecisionReverted(
  actorUserId: string | null,
  decision: Decision,
  extra?: Record<string, unknown>,
): void {
  logDecisionRecord(actorUserId, decision, "reverted", extra);
}

export function logAutonomousCycle(actorUserId: string | null, summary: Record<string, unknown>): void {
  console.log("[AI_SOCIAL_CYCLE]", truncateJson(summary, 4000));
  void logAiExecution({
    capability: "social_engine_autonomy_cycle",
    resultStatus: "success",
    userId: actorUserId,
    metadata: { ...summary, summaryJson: truncateJson(summary) },
  });
}

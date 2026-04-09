// STATUS: KEEP

/**
 * AI explainability log: writes decision, rationale, and summaries to ai_activity_log via logAiExecution.
 * Server-only. No silent drop: callers should handle insert failure.
 * Query explainability logs: metadata->>'explainability' = 'true'.
 */

import "server-only";
import { buildAiDecisionEntry, type LogAiDecisionInput } from "../engines/capabilities/logAiDecision";
import { logAiExecution } from "./aiExecutionLog";

export type LogAiDecisionParams = LogAiDecisionInput & {
  pageId?: string | null;
  userId?: string | null;
  variantId?: string | null;
  environment?: "prod" | "staging" | "preview";
  locale?: "nb" | "en";
};

export type LogAiDecisionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Writes an AI decision log entry to ai_activity_log (explainability).
 * Uses buildAiDecisionEntry for sanitized payload; merges into metadata.
 * Tool = capability that produced the decision; metadata includes explainability, decision, rationale, summaries.
 */
export async function logAiDecision(params: LogAiDecisionParams): Promise<LogAiDecisionResult> {
  const capability = (params.capability ?? "").trim();
  if (!capability) {
    return { ok: false, error: "capability is required" };
  }

  const entry = buildAiDecisionEntry(params);

  return logAiExecution({
    capability,
    resultStatus: entry.resultStatus ?? "success",
    pageId: params.pageId ?? null,
    userId: params.userId ?? null,
    variantId: params.variantId ?? null,
    environment: params.environment,
    locale: params.locale,
    metadata: entry as unknown as Record<string, unknown>,
  });
}

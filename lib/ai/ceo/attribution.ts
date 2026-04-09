import "server-only";

import { insertAiCeoLog } from "@/lib/ai/ceo/ceoLog";

export type OutcomePayload = {
  actionId: string;
  result: "success" | "failure" | "dismissed" | "manual_followup";
  impactHint?: string;
  /** Used by learning.ts (deterministic weight nudge). */
  decisionType?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Records an outcome row for later learning (no model training in-process).
 */
export async function trackOutcome(
  rid: string,
  outcome: OutcomePayload,
  opts?: { actor_user_id?: string | null; company_id?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  return insertAiCeoLog({
    rid,
    entry_type: "outcome",
    actor_user_id: opts?.actor_user_id ?? null,
    company_id: opts?.company_id ?? null,
    payload: {
      actionId: outcome.actionId,
      result: outcome.result,
      impactHint: outcome.impactHint ?? null,
      ...(outcome.decisionType ? { decisionType: outcome.decisionType } : {}),
      ...(outcome.metadata ?? {}),
    },
  });
}

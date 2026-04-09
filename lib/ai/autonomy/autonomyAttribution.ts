import "server-only";

import { insertAutonomyLog } from "@/lib/ai/autonomy/autonomyLog";
import type { AutonomyActionKind } from "@/lib/ai/autonomy/types";

export type AutonomyOutcomePayload = {
  actionId: string;
  result: "success" | "failure" | "dismissed" | "manual_followup";
  kind?: AutonomyActionKind;
  impactHint?: string;
  trafficDelta?: number | null;
  conversionDelta?: number | null;
  errorDelta?: number | null;
  metadata?: Record<string, unknown>;
};

export async function trackAutonomyOutcome(
  rid: string,
  outcome: AutonomyOutcomePayload,
  opts?: { actor_user_id?: string | null; company_id?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  return insertAutonomyLog({
    rid,
    entry_type: "autonomy_outcome",
    actor_user_id: opts?.actor_user_id ?? null,
    company_id: opts?.company_id ?? null,
    payload: {
      actionId: outcome.actionId,
      result: outcome.result,
      ...(outcome.kind ? { kind: outcome.kind } : {}),
      impactHint: outcome.impactHint ?? null,
      trafficDelta: outcome.trafficDelta ?? null,
      conversionDelta: outcome.conversionDelta ?? null,
      errorDelta: outcome.errorDelta ?? null,
      ...(outcome.metadata ?? {}),
    },
  });
}

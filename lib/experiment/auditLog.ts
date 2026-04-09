import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { opsLog } from "@/lib/ops/log";

export const EXPERIMENT_RESULT_KIND = "experiment_result" as const;

export async function logExperimentResult(
  admin: SupabaseClient,
  payload: {
    rid: string;
    experimentId?: string | null;
    before: unknown;
    after: unknown;
    measurement: unknown;
  }
): Promise<void> {
  const row = buildAiActivityLogRow({
    action: "audit",
    metadata: {
      kind: EXPERIMENT_RESULT_KIND,
      rid: payload.rid,
      experimentId: payload.experimentId ?? null,
      before: payload.before,
      after: payload.after,
      measurement: payload.measurement,
    },
  });

  const { error } = await admin.from("ai_activity_log").insert(row as Record<string, unknown>);
  if (error) {
    opsLog("experiment_result_audit_failed", { rid: payload.rid, message: error.message });
  }
}

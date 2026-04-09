import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { opsLog } from "@/lib/ops/log";

export const AUTONOMY_RUN_KIND = "autonomy_run" as const;

export async function logAutonomyRun(
  admin: SupabaseClient,
  payload: {
    rid: string;
    mode: string;
    enabled: boolean;
    actions: unknown[];
    results: unknown[];
    signals?: unknown;
    verification?: unknown;
  }
): Promise<void> {
  const row = buildAiActivityLogRow({
    action: "audit",
    metadata: {
      kind: AUTONOMY_RUN_KIND,
      rid: payload.rid,
      mode: payload.mode,
      enabled: payload.enabled,
      actions: payload.actions,
      results: payload.results,
      signals: payload.signals,
      verification: payload.verification,
      humanOverrideAllowed: true,
    },
  });

  const { error } = await admin.from("ai_activity_log").insert(row as Record<string, unknown>);
  if (error) {
    opsLog("autonomy_audit_failed", { rid: payload.rid, message: error.message });
  } else {
    opsLog("autonomy_audit_logged", { rid: payload.rid });
  }
}

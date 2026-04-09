import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { opsLog } from "@/lib/ops/log";

export const SEQUENCE_VARIANT_KIND = "sequence_variant" as const;

/**
 * Persists A/B-style sequence artifact (original snapshot vs improved text) to audit trail.
 * Does not mutate pipeline rows — observability only.
 */
export async function saveSequenceVariant(
  admin: SupabaseClient,
  payload: {
    rid: string;
    original: unknown;
    improved: string;
  }
): Promise<void> {
  const row = buildAiActivityLogRow({
    action: "audit",
    metadata: {
      kind: SEQUENCE_VARIANT_KIND,
      rid: payload.rid,
      original: payload.original,
      improved: payload.improved,
    },
  });

  const { error } = await admin.from("ai_activity_log").insert(row as Record<string, unknown>);
  if (error) {
    opsLog("sequence_variant_audit_failed", { rid: payload.rid, message: error.message });
  }
}

import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";

const ROUTE = "global_learning_store";

/**
 * Global læringsrad (read-only forklaring i metadata — ingen direkte produksjonsendring herfra).
 */
export async function storeLearning(
  admin: SupabaseClient,
  entry: Record<string, unknown>,
  rid: string
): Promise<{ ok: boolean }> {
  const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
  if (!ok) return { ok: false };

  const row = buildAiActivityLogRow({
    action: "global_learning",
    metadata: {
      kind: "global_learning_store",
      rid,
      ...entry,
    },
  });

  const { error } = await admin.from("ai_activity_log").insert({
    ...row,
    rid,
    status: "success",
  } as Record<string, unknown>);

  if (error) {
    opsLog("global_learning_insert_failed", { rid, message: error.message });
    return { ok: false };
  }
  return { ok: true };
}

import "server-only";

import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

/** Singularity conversion outcomes → `ai_memory` (separate from `ai_learning` stream). */
export { recordSingularityOutcome } from "@/lib/ai/memory/recordOutcomeLearning";

export type AiLearningSource = "blackbox" | string;

/**
 * Append-only learning row (reversible audit — no updates/deletes here).
 */
export async function recordLearning(
  source: AiLearningSource,
  data: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const supabase = supabaseAdmin();
    const payload = {
      ...data,
      recordedAt: new Date().toISOString(),
    };
    const { error } = await supabase.from("ai_learning").insert({
      source: String(source ?? "blackbox").slice(0, 64),
      data: payload,
    });
    if (error) {
      opsLog("ai_learning_insert_failed", { source, message: error.message });
      return { ok: false, message: error.message };
    }
    opsLog("ai_learning_recorded", { source, keys: Object.keys(payload) });
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("ai_learning_insert_failed", { source, message });
    return { ok: false, message };
  }
}

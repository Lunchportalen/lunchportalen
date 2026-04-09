import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

export type AiMemoryLearningRow = {
  id?: string;
  kind?: string;
  payload?: Record<string, unknown> | null;
  created_at?: string;
};

export async function getLearningByAction(actionType: string): Promise<AiMemoryLearningRow[]> {
  const key = String(actionType ?? "").trim();
  if (!key) return [];
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("ai_memory")
      .select("*")
      .eq("kind", "learning_cycle")
      .eq("action_type", key);
    if (error) {
      opsLog("learning_retrieval_failed", { actionType: key, error: error.message });
      return [];
    }
    return (data ?? []) as AiMemoryLearningRow[];
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("learning_retrieval_failed", { actionType: key, error: message });
    return [];
  }
}

import "server-only";

import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

import type { LearningRecord } from "./learningModel";

function recordToPayload(record: LearningRecord): Record<string, unknown> {
  return {
    actionType: record.actionType,
    context: record.context,
    result: record.result,
    score: record.score,
    timestamp: record.timestamp,
  };
}

export async function storeLearning(record: LearningRecord, rid: string): Promise<void> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "learning_cycle",
      payload: recordToPayload(record),
      source_rid: rid.trim() || null,
      action_type: record.actionType,
      outcome_score: Number.isFinite(record.score) ? record.score : null,
      success: record.result?.success ?? null,
    });
    opsLog("learning_stored", {
      rid,
      actionType: record.actionType,
      score: record.score,
      success: record.result?.success ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("learning_store_failed", {
      rid,
      error: message,
      actionType: record.actionType,
    });
  }
}

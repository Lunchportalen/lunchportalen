import "server-only";

import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { assertAiActionMemoryInsertReady, toAiActionMemoryInsert } from "@/lib/ai/control/aiActionMemoryRow";

/**
 * Best-effort persist of a mark to `ai_action_memory` (snake_case).
 * Never throws; does not affect in-memory dedupe semantics.
 */
export async function persistAiActionMemoryFromMark(input: {
  key: string;
  surface: string;
  actionType: string;
}): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;

  let row;
  try {
    row = toAiActionMemoryInsert(input);
    assertAiActionMemoryInsertReady(row);
  } catch {
    return;
  }

  try {
    const admin = supabaseAdmin();
    const { error } = await admin.from("ai_action_memory").insert(row);
    if (error && process.env.NODE_ENV === "development") {
      console.warn("[ai_action_memory] insert skipped:", error.message);
    }
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[ai_action_memory] insert error:", e);
    }
  }
}

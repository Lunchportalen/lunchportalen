import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";

import { SELF_HEAL_AUDIT_KIND } from "./audit";

/**
 * True if a prior run with hadExecution=true exists within the cooldown window.
 */
export async function isSelfHealCooldownActive(
  admin: SupabaseClient,
  cooldownMinutes: number
): Promise<boolean> {
  const since = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("ai_activity_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "audit")
    .contains("metadata", { kind: SELF_HEAL_AUDIT_KIND, hadExecution: true })
    .gte("created_at", since);

  if (error) {
    opsLog("self_heal_cooldown_query_failed", { message: error.message });
    return false;
  }
  return (count ?? 0) > 0;
}

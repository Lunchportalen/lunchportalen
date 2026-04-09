/**
 * Best-effort audit for pipeline motor — blokkerer aldri kaller.
 */
import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "pipeline_ai_log";

export async function logDealPrioritized(rid: string, leadId: string, score: number): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "deal_prioritized",
      metadata: { leadId, score, source: "prioritize_engine" },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[deal_prioritized_log]", error.message);
  } catch (e) {
    console.error("[deal_prioritized_log]", e instanceof Error ? e.message : String(e));
  }
}

export async function logPipelineActionExecuted(
  rid: string,
  leadId: string,
  actionType: string,
  extra?: Record<string, unknown>,
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "pipeline_action_executed",
      metadata: { leadId, actionType, ...extra },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[pipeline_action_executed_log]", error.message);
  } catch (e) {
    console.error("[pipeline_action_executed_log]", e instanceof Error ? e.message : String(e));
  }
}

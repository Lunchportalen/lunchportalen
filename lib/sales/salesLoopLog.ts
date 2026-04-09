/**
 * Audit for sales loop — blokkerer aldri kaller.
 */
import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "sales_loop_audit";

export async function logSalesLoopRun(
  rid: string,
  actionCount: number,
  extra?: Record<string, unknown>,
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "sales_loop_run",
      metadata: { actions: actionCount, rid, ...extra },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[sales_loop_run_log]", error.message);
  } catch (e) {
    console.error("[sales_loop_run_log]", e instanceof Error ? e.message : String(e));
  }
}

export async function logSalesLoopDraftSaved(
  rid: string,
  leadId: string,
  preview: string,
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "sales_loop_draft_saved",
      metadata: { leadId, messagePreview: preview.slice(0, 500), rid },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[sales_loop_draft_log]", error.message);
  } catch (e) {
    console.error("[sales_loop_draft_log]", e instanceof Error ? e.message : String(e));
  }
}

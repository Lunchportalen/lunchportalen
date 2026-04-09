/**
 * Audit for closing / møteutkast — blokkerer aldri kaller.
 */
import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "closing_suggested_audit";

export async function logClosingSuggested(rid: string, leadId: string, messagePreview: string): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "closing_suggested",
      metadata: { leadId, type: "meeting", messagePreview: messagePreview.slice(0, 400), rid },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[closing_suggested_log]", error.message);
  } catch (e) {
    console.error("[closing_suggested_log]", e instanceof Error ? e.message : String(e));
  }
}

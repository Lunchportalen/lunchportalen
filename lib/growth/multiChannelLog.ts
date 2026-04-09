/**
 * Audit: multi-channel analyse (kun lesetilgang + metadata).
 */
import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "multi_channel_analysis_audit";

export async function logMultiChannelAnalysis(
  rid: string,
  metadata: {
    channels: string[];
    actionCount: number;
    totalBudget: number;
  },
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "multi_channel_analysis",
      metadata: {
        ...metadata,
        rid,
        success: null,
      },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[multi_channel_analysis]", error.message);
  } catch (e) {
    console.error("[multi_channel_analysis]", e instanceof Error ? e.message : String(e));
  }
}

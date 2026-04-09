/**
 * Audit for revenue autopilot — blokkerer aldri kaller.
 */
import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "revenue_autopilot_audit";

export async function logRevenueAutopilotRun(
  rid: string,
  input: {
    winners: number;
    losers: number;
    actions: number;
    topRevenueSum: number;
  },
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "revenue_autopilot_run",
      metadata: {
        winners: input.winners,
        losers: input.losers,
        actions: input.actions,
        topRevenueSum: input.topRevenueSum,
        rid,
        success: null,
      },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[revenue_autopilot_run]", error.message);
  } catch (e) {
    console.error("[revenue_autopilot_run]", e instanceof Error ? e.message : String(e));
  }
}

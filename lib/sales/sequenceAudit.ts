/**
 * Audit for sekvensmotor — blokkerer aldri kaller.
 */
import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "sequence_audit";

export async function countSequenceDraftsTodayUtc(): Promise<number> {
  if (!hasSupabaseAdminConfig()) return 0;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return 0;
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { count, error } = await admin
      .from("ai_activity_log")
      .select("id", { count: "exact", head: true })
      .eq("action", "sequence_step")
      .gte("created_at", start.toISOString());
    if (error) {
      console.error("[countSequenceDraftsTodayUtc]", error.message);
      return 0;
    }
    return typeof count === "number" ? count : 0;
  } catch {
    return 0;
  }
}

export async function logSequenceStep(
  rid: string,
  input: { leadId: string; step: number; fallbackUsed: boolean; preview: string },
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "sequence_step",
      metadata: {
        leadId: input.leadId,
        step: input.step,
        fallbackUsed: input.fallbackUsed,
        preview: input.preview.slice(0, 400),
        rid,
        success: null,
      },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[sequence_step_log]", error.message);
  } catch (e) {
    console.error("[sequence_step_log]", e instanceof Error ? e.message : String(e));
  }
}

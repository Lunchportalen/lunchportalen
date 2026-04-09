/**
 * Standardisert skriving til `ai_activity_log` (sporbarhet) — feiler stille for å ikke blokkere kritiske flyter.
 */
import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "ai_activity_audit_helper";

export async function auditAiActivityEvent(input: {
  rid: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: input.action,
      metadata: {
        ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {}),
        rid: input.rid,
      },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid: input.rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[auditAiActivityEvent]", error.message);
  } catch (e) {
    console.error("[auditAiActivityEvent]", e instanceof Error ? e.message : String(e));
  }
}

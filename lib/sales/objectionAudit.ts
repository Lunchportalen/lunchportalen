/**
 * Audit for innvendingsflyt — blokkerer aldri kaller.
 */
import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "objection_audit";

export async function logObjectionHandled(
  rid: string,
  input: {
    leadId: string;
    type: string;
    strategy: string;
    fallbackUsed: boolean;
    success: null;
    replyPreview: string;
  },
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "objection_handled",
      metadata: {
        leadId: input.leadId,
        type: input.type,
        strategy: input.strategy,
        success: input.success,
        fallbackUsed: input.fallbackUsed,
        replyPreview: input.replyPreview.slice(0, 500),
        rid,
      },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[objection_handled_log]", error.message);
  } catch (e) {
    console.error("[objection_handled_log]", e instanceof Error ? e.message : String(e));
  }
}

export async function logObjectionReplyLogged(
  rid: string,
  input: { leadId: string; replyLength: number; success: null },
): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "objection_reply_logged",
      metadata: {
        leadId: input.leadId,
        replyLength: input.replyLength,
        success: input.success,
        rid,
        note: "Manuell bekreftelse i cockpit — ikke automatisk utsendelse",
      },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[objection_reply_logged]", error.message);
  } catch (e) {
    console.error("[objection_reply_logged]", e instanceof Error ? e.message : String(e));
  }
}

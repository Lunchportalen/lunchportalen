import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Læringsspor / revisjon: logg generering (best-effort, fail-closed).
 */
export async function logSalesOutreachGenerated(opts: {
  route: string;
  dealId: string;
  message: string;
  actorEmail?: string | null;
  idempotencyKey?: string | null;
}): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", opts.route);
    if (!ok) {
      console.warn("[SALES_OUTREACH_LOG]", { route: opts.route, skipped: true });
      return;
    }
    const { error } = await admin.from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "sales_outreach_generated",
        actor_user_id: opts.actorEmail ?? null,
        metadata: {
          dealId: opts.dealId,
          messagePreview: opts.message.slice(0, 500),
          idempotencyKey: opts.idempotencyKey ?? null,
        },
        tool: "sales_agent",
      }),
    );
    if (error) {
      console.error("[SALES_OUTREACH_LOG]", { message: error.message });
    }
  } catch (e) {
    console.error("[SALES_OUTREACH_LOG_FATAL]", e);
  }
}

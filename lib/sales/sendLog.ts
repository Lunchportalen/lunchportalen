import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Revisjon: alle forsøk på utsendelse / manuell LinkedIn-klar.
 */
export async function logSalesSend(opts: {
  route: string;
  dealId: string;
  channel: string;
  status: string;
  actorEmail?: string | null;
  idempotencyKey?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", opts.route);
    if (!ok) {
      console.warn("[SALES_SEND_LOG]", { skipped: true, route: opts.route });
      return;
    }
    const { error } = await admin.from("ai_activity_log").insert(
      buildAiActivityLogRow({
        action: "sales_send",
        actor_user_id: opts.actorEmail ?? null,
        metadata: {
          dealId: opts.dealId,
          channel: opts.channel,
          status: opts.status,
          idempotencyKey: opts.idempotencyKey ?? null,
          ...(opts.detail ?? {}),
        },
        tool: "sales_send",
      }),
    );
    if (error) {
      console.error("[SALES_SEND_LOG]", { message: error.message });
    }
  } catch (e) {
    console.error("[SALES_SEND_LOG_FATAL]", e);
  }
}

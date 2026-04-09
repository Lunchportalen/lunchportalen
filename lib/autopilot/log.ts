import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

const ROUTE = "autopilot_log";

export type AutopilotLogEvent = {
  kind: string;
  rid: string;
  payload?: Record<string, unknown>;
};

/**
 * Console + ops + optional ai_activity_log (fail-closed on DB).
 */
export async function logAutopilot(event: AutopilotLogEvent): Promise<void> {
  const line = {
    ...event,
    timestamp: Date.now(),
  };
  opsLog("autopilot", line);
  // eslint-disable-next-line no-console
  console.log("[AUTOPILOT]", line);

  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: "autopilot_event",
      metadata: {
        kind: event.kind,
        rid: event.rid,
        ...(event.payload ?? {}),
        timestamp: line.timestamp,
      },
    });
    await admin.from("ai_activity_log").insert({
      ...row,
      rid: event.rid,
      status: "success",
    } as Record<string, unknown>);
  } catch {
    /* fail-closed: opsLog already recorded */
  }
}

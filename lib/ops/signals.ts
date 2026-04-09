import "server-only";

import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

export type OpsSignals = {
  /** Approximate append-only audit volume (best-effort). */
  auditLogRows: number;
  /** Legacy/alternate stream if present. */
  auditEventRows: number;
};

/**
 * Read-only counts for ops visibility. Fail-closed: never throws; zeros on error.
 */
export async function getOpsSignals(): Promise<OpsSignals> {
  if (!hasSupabaseAdminConfig()) {
    return { auditLogRows: 0, auditEventRows: 0 };
  }

  try {
    const admin = supabaseAdmin();
    const [logs, events] = await Promise.all([
      admin.from("audit_logs").select("id", { count: "exact", head: true }),
      admin.from("audit_events").select("id", { count: "exact", head: true }),
    ]);

    if (logs.error) {
      opsLog("ops_signals_audit_logs_count_failed", { message: logs.error.message });
    }
    if (events.error) {
      opsLog("ops_signals_audit_events_count_failed", { message: events.error.message });
    }

    return {
      auditLogRows: typeof logs.count === "number" ? logs.count : 0,
      auditEventRows: typeof events.count === "number" ? events.count : 0,
    };
  } catch (e) {
    opsLog("ops_signals_exception", { message: e instanceof Error ? e.message : String(e) });
    return { auditLogRows: 0, auditEventRows: 0 };
  }
}

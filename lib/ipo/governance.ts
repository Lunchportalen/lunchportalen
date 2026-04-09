import "server-only";

import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";

export type GovernanceStatus = {
  auditEvents: number;
  auditLogs: number;
  status: "COMPLIANT" | "RISK";
};

/**
 * Governance-synlighet fra revisjonsvolum (head count). Fail-closed: null config → RISK med nuller.
 */
export async function getGovernanceStatus(): Promise<GovernanceStatus> {
  if (!hasSupabaseAdminConfig()) {
    return { auditEvents: 0, auditLogs: 0, status: "RISK" };
  }

  try {
    const admin = supabaseAdmin();
    const [logs, events] = await Promise.all([
      admin.from("audit_logs").select("id", { count: "exact", head: true }),
      admin.from("audit_events").select("id", { count: "exact", head: true }),
    ]);

    if (logs.error) {
      opsLog("ipo_governance_audit_logs_count_failed", { message: logs.error.message });
    }
    if (events.error) {
      opsLog("ipo_governance_audit_events_count_failed", { message: events.error.message });
    }

    const auditLogs = typeof logs.count === "number" ? logs.count : 0;
    const auditEvents = typeof events.count === "number" ? events.count : 0;
    const hasTrail = auditLogs + auditEvents > 0;

    return {
      auditEvents,
      auditLogs,
      status: hasTrail ? "COMPLIANT" : "RISK",
    };
  } catch (e) {
    opsLog("ipo_governance_exception", { message: e instanceof Error ? e.message : String(e) });
    return { auditEvents: 0, auditLogs: 0, status: "RISK" };
  }
}

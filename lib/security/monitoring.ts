// lib/security/monitoring.ts
import "server-only";

import { opsLog } from "@/lib/ops/log";
import { scheduleAuditEvent } from "@/lib/security/audit";

export type SecurityMonitorSeverity = "info" | "warn" | "critical";

export type SecurityMonitorEvent = {
  type: string;
  severity: SecurityMonitorSeverity;
  message: string;
  companyId?: string | null;
  userId?: string | null;
  context?: Record<string, unknown>;
};

/**
 * Structured security telemetry (stdout JSON). Critical events also append audit_logs when admin is configured.
 */
export function trackSecurityEvent(event: SecurityMonitorEvent): void {
  const payload = {
    ts: new Date().toISOString(),
    type: event.type,
    severity: event.severity,
    message: event.message,
    companyId: event.companyId ?? null,
    userId: event.userId ?? null,
    context: event.context ?? {},
  };
  opsLog("security_monitor", payload);

  if (event.severity === "critical" || event.severity === "warn") {
    scheduleAuditEvent({
      companyId: event.companyId ?? null,
      userId: event.userId ?? null,
      action: `security.monitor.${event.type}`,
      resource: "security_monitoring",
      metadata: {
        severity: event.severity,
        message: event.message,
        ...payload.context,
      },
    });
  }
}

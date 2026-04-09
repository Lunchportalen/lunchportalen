/**
 * Lightweight anomaly hints over audit samples (best-effort, non-blocking).
 */

export type SuspiciousAuditHint = "high_activity" | null;

export function detectSuspicious(events: ReadonlyArray<unknown>): SuspiciousAuditHint {
  if (events.length > 50) {
    return "high_activity";
  }
  return null;
}

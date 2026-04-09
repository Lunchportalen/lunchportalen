import "server-only";

import { opsLog } from "@/lib/ops/log";

/**
 * Usage-shaped billing signals (readiness only; no provider calls).
 */
export function trackUsage(event: Record<string, unknown>): void {
  try {
    opsLog("billing_event", { ...event, channel: "saas_usage" });
  } catch {
    /* never throw */
  }
}

import "server-only";

import { opsLog } from "@/lib/ops/log";

/**
 * Strukturert autonomi-logg (konsoll + observability-kø).
 */
export function logAutonomy(event: Record<string, unknown>) {
  try {
    opsLog("social_autonomy", {
      ...event,
      ts: new Date().toISOString(),
    });
  } catch {
    console.log("[AUTONOMY]", event);
  }
}

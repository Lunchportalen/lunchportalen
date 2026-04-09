/**
 * Filtrerer med kjøling, konsoll og best-effort logging (blokkerer ikke kritiske flyter).
 */

import "server-only";

import { logAiExecution } from "@/lib/ai/logging/aiExecutionLog";
import type { Alert, AlertType } from "@/lib/alerts/types";
import { applyCooldownGate } from "@/lib/alerts/guard";

export type FinancialDispatchResult = {
  sent: Alert[];
  suppressed: Array<{ type: AlertType; reason: string }>;
};

export async function dispatchFinancialAlerts(
  alerts: Alert[],
  options?: { actorUserId?: string | null },
): Promise<FinancialDispatchResult> {
  const { sent, suppressed } = applyCooldownGate(alerts);

  for (const alert of sent) {
    if (typeof console !== "undefined" && typeof console.log === "function") {
      console.log("[ALERT]", alert.type, alert.severity, alert.message, alert.id);
    }
  }

  if (sent.length > 0 || suppressed.length > 0) {
    void logAiExecution({
      capability: "financial_alert_dispatch",
      resultStatus: "success",
      userId: options?.actorUserId ?? null,
      metadata: {
        domain: "financial_alerts",
        dispatched: sent.map((a) => ({
          type: a.type,
          severity: a.severity,
          message: a.message,
          id: a.id,
          context: a.context ?? null,
        })),
        suppressed,
        note: "Kontrolltårn — ingen automatisk handling.",
      },
    });
  }

  return { sent, suppressed };
}

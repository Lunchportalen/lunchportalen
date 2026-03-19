// lib/observability/alertEvaluator.ts
// Breach detection and alert-ready state from SLI results. No fake alerting.
import type { SliResult, AlertState, AlertSeverity } from "./types";
import { SLO_REGISTRY } from "./sloRegistry";

/**
 * Given SLI results, produce alert states for breach and sustained degradation.
 * Alert transport (PagerDuty/Slack/email) is NOT implemented; output is alert-ready for operators or future wiring.
 */
export function evaluateAlerts(slis: SliResult[], nowIso: string): AlertState[] {
  const alerts: AlertState[] = [];

  for (const sli of slis) {
    const def = SLO_REGISTRY[sli.sloId];
    if (!def) continue;

    const common: Pick<AlertState, "sloId" | "serviceId" | "sliRatePercent" | "since" | "evidence" | "operatorHint"> = {
      sloId: sli.sloId,
      serviceId: def.serviceId,
      sliRatePercent: sli.ratePercent,
      since: nowIso,
      evidence: sli.evidence,
      operatorHint: def.operatorHint,
    };

    if (sli.status === "breach") {
      alerts.push({
        ...common,
        severity: "critical",
        message: `SLO ${def.name}: ${sli.message}`,
        thresholdPercent: def.criticalThresholdPercent,
      });
    } else if (sli.status === "warn") {
      alerts.push({
        ...common,
        severity: "warning",
        message: `SLO ${def.name} (advarsel): ${sli.message}`,
        thresholdPercent: def.warnThresholdPercent,
      });
    }
  }

  return alerts;
}

/** Whether any alert is critical (for overall status). */
export function hasCriticalAlert(alerts: AlertState[]): boolean {
  return alerts.some((a) => a.severity === "critical");
}

/** Whether any alert is warning or critical. */
export function hasWarningOrCritical(alerts: AlertState[]): boolean {
  return alerts.length > 0;
}

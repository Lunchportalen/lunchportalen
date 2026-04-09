import "server-only";

import type { AnomalyReport } from "@/lib/ai/anomaly";

export type EventTriggerResult = {
  shouldRun: boolean;
  reasons: string[];
};

/**
 * Event-style gate: traffic/conversion/error signals suggest running a cycle (caller still applies rate limit).
 */
export function evaluateAutonomyEventTriggers(report: AnomalyReport): EventTriggerResult {
  if (report.trafficDrop || report.conversionDrop || report.errorSpike) {
    return {
      shouldRun: true,
      reasons: [...report.reasons],
    };
  }
  return { shouldRun: false, reasons: [] };
}

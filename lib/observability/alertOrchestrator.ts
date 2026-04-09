import "server-only";

import { sendAlertEmail } from "@/lib/integrations/alertEmailEngine";
import { sendSlackAlert } from "@/lib/integrations/slackEngine";
import { opsLog } from "@/lib/ops/log";

import { detectPredictiveAnomalies } from "./predictiveAnomalyEngine";
import type { PredictiveCheckResult } from "./predictiveEngine";
import { shouldSendAlert } from "./alertThrottle";
import type { MetricsSnapshot } from "./metricsEngine";

/**
 * Predictive (z-score) alerting: throttled Slack/email, full structured logs.
 * Never throws; returns findings for persistence upstream.
 */
export async function runAlerting(snapshot: MetricsSnapshot): Promise<PredictiveCheckResult[]> {
  let findings: PredictiveCheckResult[] = [];
  try {
    findings = await detectPredictiveAnomalies(snapshot);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("predictive_anomaly_scan_failed", { message });
    return [];
  }

  for (const result of findings) {
    opsLog("predictive_anomaly", {
      metric: result.metric,
      score: result.score,
      level: result.level,
      baseline: result.baseline,
      value: result.value,
    });

    const throttleKey = `predictive:${result.metric}:${result.level}`;
    if (!shouldSendAlert(throttleKey)) {
      opsLog("alert_throttled", { type: throttleKey });
      continue;
    }
    const message = `🚨 PREDICTIVE ${result.level}: ${result.metric} (z=${result.score.toFixed(2)})`;
    await sendSlackAlert(message);
    await sendAlertEmail(message);
    opsLog("alert_triggered", {
      type: throttleKey,
      metrics: snapshot,
      predictive: result,
    });
  }

  return findings;
}

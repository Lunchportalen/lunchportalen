import type { AutopilotMetrics, AutopilotOpportunity } from "@/lib/autopilot/types";

/** NOK — under dette flagges lav omsetning (deterministisk terskel). */
const LOW_REVENUE_THRESHOLD_NOK = 5000;

/**
 * Deterministic opportunity detection from real aggregates (thresholds are explicit).
 */
export function detectOpportunities(metrics: AutopilotMetrics): AutopilotOpportunity[] {
  const issues: AutopilotOpportunity[] = [];

  if (metrics.conversionRate < 0.02) {
    issues.push({ type: "low_conversion", severity: Math.min(1, 0.02 - metrics.conversionRate) });
  }

  if (metrics.bounceRate > 0.6) {
    issues.push({ type: "high_bounce", severity: Math.min(1, metrics.bounceRate - 0.6) });
  }

  if (metrics.sessions < 200 && metrics.posts > 0) {
    issues.push({ type: "thin_traffic", severity: Math.min(1, (200 - metrics.sessions) / 200) });
  }

  if (metrics.revenue < LOW_REVENUE_THRESHOLD_NOK && metrics.posts > 0) {
    issues.push({
      type: "low_revenue",
      severity: Math.min(1, (LOW_REVENUE_THRESHOLD_NOK - metrics.revenue) / LOW_REVENUE_THRESHOLD_NOK),
    });
  }

  issues.sort((a, b) => b.severity - a.severity);
  return issues;
}

/**
 * Single highest-severity opportunity for the controlled autopilot loop (or none).
 */
export function detectOpportunity(metrics: AutopilotMetrics): AutopilotOpportunity | null {
  const list = detectOpportunities(metrics);
  return list[0] ?? null;
}

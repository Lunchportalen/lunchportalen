export type StrategicCeoDecision = {
  action: string;
  priority: "high" | "medium" | "low";
};

export type StrategicCeoMetrics = {
  revenue: number;
  previousRevenue: number;
  sessions: number;
  previousSessions: number;
};

/**
 * Deterministic rule layer (no LLM). Complements {@link runCEO} in `./ceo`.
 */
export function aiCeoDecision(input: { metrics: StrategicCeoMetrics }): StrategicCeoDecision[] {
  const { metrics } = input;
  const decisions: StrategicCeoDecision[] = [];

  if (metrics.revenue < metrics.previousRevenue) {
    decisions.push({ action: "increase_conversion_focus", priority: "high" });
  }

  if (metrics.sessions < metrics.previousSessions) {
    decisions.push({ action: "increase_traffic", priority: "medium" });
  }

  return decisions;
}

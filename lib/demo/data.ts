/**
 * Investor demo — display-only numbers (no API/DB).
 * Shape matches ControlViewModel (health required).
 */

/** Pitch-ready KPI bundle (deterministic, additive). */
export function getDemoMetrics() {
  return {
    revenue: 124_500,
    aiRevenue: 84_500,
    conversionRate: 0.064,
    growth: 18.2,
    orders: 932,
  };
}

export const demoData = {
  revenue: 128_000,
  forecast: 320_000,
  leads: 42,
  actions: [
    { message: "Skaler vinnende kampanje" },
    { message: "Følg opp varme leads" },
    { message: "Øk posting volume" },
  ],
  health: "ok",
  healthLevel: "ok" as const,
  trendDirection: "up" as const,
  activeAlerts: 0,
  criticalAlerts: 0,
};

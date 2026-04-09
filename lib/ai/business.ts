import "server-only";

export type BusinessMetrics = {
  orders?: number;
  conversionRate?: number;
};

export function generateBusinessIntent(metrics: BusinessMetrics): { goal: string } {
  const orders = typeof metrics.orders === "number" && Number.isFinite(metrics.orders) ? metrics.orders : 0;
  const cr =
    typeof metrics.conversionRate === "number" && Number.isFinite(metrics.conversionRate)
      ? metrics.conversionRate
      : 0;

  if (orders === 0) {
    return { goal: "increase_demand" };
  }

  if (cr < 0.02) {
    return { goal: "increase_conversion" };
  }

  return { goal: "scale" };
}

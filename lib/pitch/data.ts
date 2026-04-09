import "server-only";

import { collectSignals } from "@/lib/ai/signals";
import { getDemoMetrics } from "@/lib/demo/data";
import { getLiveMetrics } from "@/lib/metrics/live";

export type PitchMetrics = {
  revenue: number;
  aiRevenue: number;
  conversionRate: number;
  growth: number;
  orders: number;
};

/**
 * Demo: static numbers. Live: AI signals from `ai_activity_log` (always safe for public read).
 * Optional merge of real order totals when `PITCH_ALLOW_ORDER_AGGREGATE=true` (ops-approved only).
 */
export async function getPitchData(mode: "demo" | "live"): Promise<PitchMetrics> {
  if (mode === "demo") {
    return getDemoMetrics();
  }

  const signals = await collectSignals();
  const allowOrders = process.env.PITCH_ALLOW_ORDER_AGGREGATE === "true";

  if (!allowOrders) {
    return {
      revenue: signals.revenue,
      aiRevenue: signals.revenue,
      conversionRate: signals.conversionRate,
      growth: 0,
      orders: signals.conversions,
    };
  }

  const metrics = await getLiveMetrics();

  return {
    revenue: metrics.revenue,
    aiRevenue: signals.revenue,
    conversionRate: signals.conversionRate,
    growth: 0,
    orders: metrics.orders,
  };
}

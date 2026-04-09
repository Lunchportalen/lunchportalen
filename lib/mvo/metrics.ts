import { buildPerformanceMap } from "./performanceMemory";
import type { MvoComboMetrics } from "./types";

export type OrderLike = {
  market_id?: string | null;
  variant_channel?: string | null;
  variant_segment?: string | null;
  variant_timing?: string | null;
  line_total?: unknown;
  total_amount?: unknown;
};

/** Beholdt for bakoverkompatibilitet — delegerer til `buildPerformanceMap`. */
export function computeMvoMetrics(orders: OrderLike[]): Record<string, MvoComboMetrics> {
  return buildPerformanceMap(orders);
}

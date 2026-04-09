import "server-only";

import { withCache } from "@/lib/core/withCache";
import { getRevenueAttribution } from "@/lib/revenue/aiRevenueAttribution";

/**
 * Simple deterministic growth factor on current attributed revenue (estimate only).
 */
export async function getAiRevenueForecast(): Promise<{ current: number; projected: number }> {
  return withCache(
    "revenue:forecast:v1",
    async () => {
      const data = await getRevenueAttribution();
      let total = 0;
      for (const k of Object.keys(data)) {
        total += data[k];
      }
      const projected = total * 1.2;
      return { current: total, projected };
    },
    { ttlMs: 30_000 },
  );
}

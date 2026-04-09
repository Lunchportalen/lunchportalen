import "server-only";

import { getPromptPerformance } from "@/lib/ai/performance";
import { withCache } from "@/lib/core/withCache";

/**
 * Revenue per prompt key from tracked `ai_conversion` metadata (deterministic, fail-closed).
 */
export async function getRevenueAttribution(): Promise<Record<string, number>> {
  return withCache(
    "revenue:attribution:v1",
    async () => {
      try {
        const perf = await getPromptPerformance();
        const map: Record<string, number> = {};
        for (const [k, v] of Object.entries(perf)) {
          map[k] = typeof v.revenue === "number" && Number.isFinite(v.revenue) ? v.revenue : 0;
        }
        return map;
      } catch {
        return {};
      }
    },
    { ttlMs: 30_000 },
  );
}

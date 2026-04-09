import "server-only";

import { withCache } from "@/lib/core/withCache";
import { withTimeout } from "@/lib/core/timeout";
import { generateMessaging } from "@/lib/market/message";
import { generatePositioning } from "@/lib/market/positioning";

export type MarketBundle = { positioning: string; messaging: string };

/**
 * Parallel AI calls with per-call timeouts; short-lived bundle cache for load safety.
 */
export async function getMarketBundle(): Promise<MarketBundle> {
  return withCache(
    "market:bundle:v1",
    async () => {
      const [positioning, messaging] = await Promise.all([
        withTimeout(generatePositioning(), 12_000),
        withTimeout(generateMessaging(), 12_000),
      ]);
      return { positioning, messaging };
    },
    { ttlMs: 300_000 },
  );
}

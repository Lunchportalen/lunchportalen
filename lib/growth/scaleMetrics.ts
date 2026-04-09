import "server-only";

import type { ScaleChannelRow } from "@/lib/growth/optimizer";

/**
 * Erstatt med faktiske kanalspend + konverteringer når datakilder er koblet.
 */
export async function getGrowthMetrics(): Promise<{ channels: ScaleChannelRow[] }> {
  return {
    channels: [
      { id: "meta", budget: 1000, cac: 0, ltv: null },
      { id: "tiktok", budget: 500, cac: 0, ltv: null },
    ],
  };
}

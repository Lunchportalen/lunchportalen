/**
 * Illustrativ kontekst for simulering i superadmin (ingen produksjonsdata).
 */

import type { BusinessContext } from "@/lib/autonomy/types";

export function makeDemoAutonomyContext(): BusinessContext {
  return {
    dataComplete: true,
    dailySpend: 1200,
    totalSpend: 12000,
    roas: 2.4,
    margin: 0.32,
    signals: {
      wantAdsScale: true,
      wantPricingTweak: true,
      wantProcurement: true,
      wantContent: true,
      wantVideo: true,
    },
  };
}

import "server-only";

import type { SystemContext } from "@/lib/ai/context/systemContext";
import { insertAutonomyLog } from "@/lib/ai/autonomy/autonomyLog";

export type AnomalyReport = {
  trafficDrop: boolean;
  conversionDrop: boolean;
  errorSpike: boolean;
  aiUsageUnusual: boolean;
  reasons: string[];
};

/**
 * Log-only anomaly hints — never auto-remediate.
 */
export async function detectAnomaliesAndLog(rid: string, ctx: SystemContext): Promise<AnomalyReport> {
  const reasons: string[] = [];
  const pv = ctx.analytics.pageViews24h;
  const ev = ctx.analytics.events24h;
  const cta = ctx.analytics.ctaClicks24h;

  const trafficDrop = pv > 0 && pv < 25 && ev < 40;
  if (trafficDrop) reasons.push("lav_pageview_siste_dogn");

  const ctr = pv > 0 ? cta / pv : 0;
  const conversionDrop = pv > 60 && ctr < 0.008;
  if (conversionDrop) reasons.push("lav_cta_rate");

  const errorSpike = ctx.errors.recentCount24h > 25;
  if (errorSpike) reasons.push("feilspiss");

  const aiUsageUnusual = false;

  if (reasons.length) {
    await insertAutonomyLog({
      rid,
      entry_type: "autonomy_anomaly",
      payload: {
        trafficDrop,
        conversionDrop,
        errorSpike,
        aiUsageUnusual,
        reasons,
        snapshotRid: ctx.rid,
      },
    });
  }

  return { trafficDrop, conversionDrop, errorSpike, aiUsageUnusual, reasons };
}

/**
 * Genererer kandidat-handlinger fra kontekst — deterministisk, ingen I/O.
 */

import type { AutonomousAction, BusinessContext } from "@/lib/autonomy/types";

export function generateActions(context: BusinessContext): AutonomousAction[] {
  if (!context.dataComplete) {
    return [];
  }

  const out: AutonomousAction[] = [];
  const s = context.signals ?? {};

  if (s.wantAdsScale) {
    out.push({
      type: "ads_adjust",
      reason: "Signal: skaler annonser innen daglig tak (policy).",
      expectedProfit: 120,
      riskLevel: "medium",
      payload: { dailySpend: Math.min(context.dailySpend ?? 800, 4800) },
    });
  }
  if (s.wantPricingTweak) {
    out.push({
      type: "pricing_adjust",
      reason: "Signal: mindre prisjustering innen maks endring.",
      expectedProfit: 80,
      riskLevel: "high",
      payload: { priceDeltaPct: 0.05 },
    });
  }
  if (s.wantProcurement) {
    out.push({
      type: "procurement_suggest",
      reason: "Signal: innkjøpsforslag under makskost.",
      expectedProfit: 60,
      riskLevel: "medium",
      payload: { estProcurementCost: 4000 },
    });
  }
  if (s.wantContent) {
    out.push({
      type: "content_generate",
      reason: "Signal: nytt innhold (kun etter godkjenning i produksjon).",
      expectedProfit: 40,
      riskLevel: "low",
    });
  }
  if (s.wantVideo) {
    out.push({
      type: "video_generate",
      reason: "Signal: videoforslag (kun etter godkjenning i produksjon).",
      expectedProfit: 35,
      riskLevel: "medium",
    });
  }

  return out;
}

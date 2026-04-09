/**
 * Lukket sløyfe: beslutning ut fra aggregert omsetning mot kampanjens spend.
 * Ingen auto-budsjett — kun anbefaling; godkjenning skjer i eksisterende ads-flyt.
 */

import { guardrails } from "@/lib/ads/guardrails";
import { ATTRIBUTION_CONFIDENCE_THRESHOLD, scoreAttribution } from "@/lib/revenue/confidence";
import type { RevenueEvent } from "@/lib/revenue/unified";

export type ClosedLoopOptimization = "scale" | "pause" | "hold";

export function optimizeFromRevenue(campaign: { spend: number }, events: RevenueEvent[]): ClosedLoopOptimization {
  const spend = typeof campaign.spend === "number" && Number.isFinite(campaign.spend) ? Math.max(0, campaign.spend) : 0;
  const revenue = events.reduce((s, e) => s + (Number.isFinite(e.amount) ? Math.max(0, e.amount) : 0), 0);
  if (revenue <= 0) return "hold";
  if (spend <= 0) return "hold";
  const roas = revenue / spend;
  if (!Number.isFinite(roas)) return "hold";
  const allAboveConfidenceThreshold =
    events.length > 0 && events.every((e) => scoreAttribution(e) > ATTRIBUTION_CONFIDENCE_THRESHOLD);
  if (roas > guardrails.portfolioRoasAllowAggressiveScaleAbove && allAboveConfidenceThreshold) return "scale";
  if (roas < 1) return "pause";
  return "hold";
}

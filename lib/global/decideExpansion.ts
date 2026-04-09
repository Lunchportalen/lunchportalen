/**
 * Skaler/stopp basert på faktisk omsetning — kun anbefalinger (ingen auto-utførelse).
 */
import type { MarketPerformanceMap } from "@/lib/global/marketPerformance";

export type ExpansionDecisionAction = {
  market: string;
  action: "scale" | "stop" | "hold";
  reason: string;
  /** Alltid true — ingen automatisk endring i DB. */
  recommendationOnly: true;
};

const SCALE_REVENUE_NOK = 10_000;
const STOP_REVENUE_NOK = 1_000;

const HOME_MARKET = "no";

export function decideExpansion(performance: MarketPerformanceMap): ExpansionDecisionAction[] {
  const actions: ExpansionDecisionAction[] = [];

  for (const [market, data] of Object.entries(performance)) {
    if (market === "unknown") continue;
    const revenue = typeof data.revenue === "number" ? data.revenue : 0;
    const orders = typeof data.orders === "number" ? data.orders : 0;

    if (market === HOME_MARKET) {
      if (revenue > SCALE_REVENUE_NOK) {
        actions.push({
          market,
          action: "scale",
          reason: `Hjemmemarked: omsetning ${revenue.toFixed(0)} NOK — sterk base for videre nordisk pilot.`,
          recommendationOnly: true,
        });
      } else {
        actions.push({
          market,
          action: "hold",
          reason: `Hjemmemarked: omsetning ${revenue.toFixed(0)} NOK — ingen auto-stopp for kjerne marked.`,
          recommendationOnly: true,
        });
      }
      continue;
    }

    if (revenue > SCALE_REVENUE_NOK) {
      actions.push({
        market,
        action: "scale",
        reason: `Omsetning ${revenue.toFixed(0)} NOK > ${SCALE_REVENUE_NOK} (vurder kontrollert opptrapping).`,
        recommendationOnly: true,
      });
    } else if (revenue < STOP_REVENUE_NOK) {
      actions.push({
        market,
        action: "stop",
        reason:
          orders > 0
            ? `Omsetning ${revenue.toFixed(0)} NOK < ${STOP_REVENUE_NOK} med ordre — vurder å pause pilot.`
            : `Ingen eller lav omsetning (${revenue.toFixed(0)} NOK) — vurder å pause pilot.`,
        recommendationOnly: true,
      });
    } else {
      actions.push({
        market,
        action: "hold",
        reason: `Hold pilot; omsetning ${revenue.toFixed(0)} NOK (mellom terskler).`,
        recommendationOnly: true,
      });
    }
  }

  return actions;
}

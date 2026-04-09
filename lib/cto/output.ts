import type { CtoOpportunity, CtoStrategyRow } from "./types";

export function buildStrategy(opportunities: CtoOpportunity[]): CtoStrategyRow[] {
  return opportunities.map((o, i) => ({
    priority: i + 1,
    action: o.action,
    expectedImpact: o.expectedRevenueLift,
    explain: o.explain,
  }));
}

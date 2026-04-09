import type { CapitalState } from "@/lib/ai/capital/capitalState";
import type { InvestmentArea } from "@/lib/ai/capital/investmentAreas";

export function estimateROI(area: InvestmentArea | string, state: CapitalState): number {
  switch (area) {
    case "ACQUISITION":
      return state.ltv > state.cac ? 0.3 : 0.1;
    case "CONVERSION":
      return state.conversion < 0.03 ? 0.5 : 0.2;
    case "RETENTION":
      return state.churn > 0.05 ? 0.6 : 0.2;
    case "PRODUCT":
      return state.growth < 0.1 ? 0.4 : 0.2;
    case "CONTENT":
      return state.traffic < 1000 ? 0.5 : 0.25;
    case "INFRASTRUCTURE":
      return state.burn > state.revenue ? 0.3 : 0.1;
    default:
      return 0.1;
  }
}

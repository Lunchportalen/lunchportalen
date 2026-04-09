import type { CapitalState } from "@/lib/ai/capital/capitalState";
import type { InvestmentArea } from "@/lib/ai/capital/investmentAreas";

export function estimateRisk(area: InvestmentArea | string, state: CapitalState): number {
  switch (area) {
    case "ACQUISITION":
      return state.cac > state.ltv ? 0.8 : 0.3;
    case "CONVERSION":
      return 0.2;
    case "RETENTION":
      return 0.3;
    case "PRODUCT":
      return 0.5;
    case "CONTENT":
      return 0.4;
    case "INFRASTRUCTURE":
      return 0.6;
    default:
      return 0.5;
  }
}

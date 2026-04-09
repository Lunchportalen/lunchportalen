import type { CapitalState } from "@/lib/ai/capital/capitalState";
import type { InvestmentArea } from "@/lib/ai/capital/investmentAreas";

export type BudgetPlanAction = { type: string };

export function generateActions(area: InvestmentArea | string, _state: CapitalState): BudgetPlanAction[] {
  void _state;
  switch (area) {
    case "ACQUISITION":
      return [{ type: "LAUNCH_AD_CAMPAIGN" }, { type: "TEST_NEW_CHANNEL" }];
    case "CONVERSION":
      return [{ type: "RUN_AB_TEST" }, { type: "OPTIMIZE_CTA" }];
    case "RETENTION":
      return [{ type: "EMAIL_SEQUENCE" }, { type: "LOYALTY_FLOW" }];
    case "CONTENT":
      return [{ type: "CREATE_LANDING_PAGE" }, { type: "SEO_ARTICLE" }];
    case "PRODUCT":
      return [{ type: "FEATURE_IMPROVEMENT" }];
    default:
      return [];
  }
}

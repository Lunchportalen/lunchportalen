import type { BudgetPlanAction } from "@/lib/ai/capital/actionGenerator";

export function estimateActionCost(action: BudgetPlanAction | { type?: unknown }): number {
  const t = String((action as BudgetPlanAction)?.type ?? "").trim();
  switch (t) {
    case "RUN_AB_TEST":
      return 20;
    case "CREATE_LANDING_PAGE":
      return 30;
    case "LAUNCH_AD_CAMPAIGN":
      return 25;
    case "EMAIL_SEQUENCE":
      return 15;
    case "TEST_NEW_CHANNEL":
      return 15;
    case "OPTIMIZE_CTA":
      return 12;
    case "LOYALTY_FLOW":
      return 12;
    case "SEO_ARTICLE":
      return 15;
    case "FEATURE_IMPROVEMENT":
      return 18;
    default:
      return 10;
  }
}

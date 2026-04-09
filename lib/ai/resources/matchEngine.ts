import type { BudgetPlanAction } from "@/lib/ai/capital/actionGenerator";
import type { Resource } from "@/lib/ai/resources/resourceModel";

export function matchResource(action: BudgetPlanAction | { type?: unknown }, resources: Resource[]): Resource | null {
  const t = String((action as BudgetPlanAction)?.type ?? "").trim();
  for (const r of resources) {
    if (t === "RUN_AB_TEST" && r.skills.includes("ab_testing")) return r;
    if (t === "OPTIMIZE_CTA" && r.skills.includes("conversion")) return r;
    if (t === "CREATE_LANDING_PAGE" && r.skills.includes("content")) return r;
    if (t === "SEO_ARTICLE" && r.skills.includes("seo")) return r;
    if (t === "LAUNCH_AD_CAMPAIGN" && r.skills.includes("ads")) return r;
    if (t === "TEST_NEW_CHANNEL" && r.skills.includes("ads")) return r;
    if (t === "EMAIL_SEQUENCE" && r.skills.includes("automation")) return r;
    if (t === "LOYALTY_FLOW" && r.skills.includes("automation")) return r;
    if (t === "FEATURE_IMPROVEMENT" && r.skills.includes("execution")) return r;
  }
  return null;
}

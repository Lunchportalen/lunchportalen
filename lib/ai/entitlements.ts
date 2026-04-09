import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

const PLANS_WITH_AI = new Set(["basic", "pro", "enterprise"]);

export function planAllowsAi(plan: string): boolean {
  return PLANS_WITH_AI.has(plan);
}

/**
 * Resolve company saas_plan (raw string, may be "none").
 * Throws MISSING_COMPANY_ID, ENTITLEMENTS_READ_FAILED.
 */
export async function getCompanySaasPlanForAi(companyId: string): Promise<string> {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) {
    throw new Error("MISSING_COMPANY_ID");
  }

  const { data, error } = await supabaseAdmin().from("companies").select("saas_plan").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(`ENTITLEMENTS_READ_FAILED: ${error.message}`);
  }

  return typeof data?.saas_plan === "string" ? data.saas_plan : "none";
}

/**
 * Fail-closed: company must exist and saas_plan must allow AI inference.
 */
export async function assertCompanyAiPlanAllows(companyId: string): Promise<void> {
  const plan = await getCompanySaasPlanForAi(companyId);
  if (!planAllowsAi(plan)) {
    throw new Error(`PLAN_NOT_ALLOWED: saas_plan=${plan}`);
  }
}

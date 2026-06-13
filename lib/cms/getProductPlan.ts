import "server-only";

import { menuDayProviderGroqClause } from "@/lib/cms/menuDayProviderFilter";
import type { PlanTier as AgreementPlanTier } from "@/lib/agreements/types";
import { sanity } from "@/lib/sanity/client";
import type { CmsProductPlan, CmsProductPlanName } from "@/lib/cms/types";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

export type ProductPlanQueryOptions = {
  providerSlug?: string | null;
};

function normPlanName(raw: unknown): CmsProductPlanName | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "basis") return "basis";
  if (s === "luxus" || s === "luksus") return "luxus";
  if (s === "enterprise") return "enterprise";
  return null;
}

/** Sanity `productPlan.name` for agreement tier (MP5: 3-tier). */
export function cmsPlanNameForAgreementTier(tier: AgreementPlanTier): CmsProductPlanName {
  if (tier === "BASIS") return "basis";
  if (tier === "LUXUS") return "luxus";
  return "enterprise";
}

export async function getProductPlanForAgreementTier(
  tier: AgreementPlanTier,
  opts?: ProductPlanQueryOptions,
): Promise<CmsProductPlan | null> {
  return getProductPlan(cmsPlanNameForAgreementTier(tier), opts);
}

export async function getProductPlan(
  name: CmsProductPlanName,
  opts?: ProductPlanQueryOptions,
): Promise<CmsProductPlan | null> {
  try {
    const provider = menuDayProviderGroqClause(opts?.providerSlug);
    const doc = await sanity.fetch(
      `*[
        _type == "productPlan" &&
        name == $name &&
        (${provider.clause})
      ][0]{
        name,
        price,
        allowedMeals,
        allowedMealTypes,
        includesWarm,
        rules,
        allowDailyVariation
      }`,
      { name, ...provider.params },
    );
    if (!doc || typeof doc !== "object") return null;
    const n = normPlanName((doc as any).name);
    if (!n) return null;
    const price = Number((doc as any).price);
    const allowedNew = Array.isArray((doc as any).allowedMeals) ? (doc as any).allowedMeals : [];
    const allowedLegacy = Array.isArray((doc as any).allowedMealTypes) ? (doc as any).allowedMealTypes : [];
    const allowedRaw = allowedNew.length ? allowedNew : allowedLegacy;
    let allowedMeals = allowedRaw.map((x: unknown) => normalizeMealTypeKey(x)).filter(Boolean);
    const includesWarm = (doc as { includesWarm?: boolean | null }).includesWarm !== false;
    if (includesWarm && !allowedMeals.includes("varmmat")) {
      allowedMeals = [...allowedMeals, "varmmat"];
    }
    if (!Number.isFinite(price) || price <= 0 || !allowedMeals.length) return null;

    const rulesObj = (doc as any).rules && typeof (doc as any).rules === "object" ? (doc as any).rules : null;
    const allowDailyVariation = Boolean(
      rulesObj && typeof (rulesObj as any).allowDailyVariation === "boolean"
        ? (rulesObj as any).allowDailyVariation
        : (doc as any).allowDailyVariation
    );

    return {
      name: n,
      price,
      allowedMeals,
      rules: { allowDailyVariation },
    };
  } catch (e: any) {
    console.warn("[cms/getProductPlan] fetch failed", { name, detail: String(e?.message ?? e) });
    return null;
  }
}

import "server-only";

import { sanity } from "@/lib/sanity/client";
import type { CmsProductPlan } from "@/lib/cms/types";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

function normPlanName(raw: unknown): "basis" | "luxus" | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "basis") return "basis";
  if (s === "luxus" || s === "luksus") return "luxus";
  return null;
}

export async function getProductPlan(name: "basis" | "luxus"): Promise<CmsProductPlan | null> {
  try {
    const doc = await sanity.fetch(
      `*[_type == "productPlan" && name == $name][0]{
        name,
        price,
        allowedMeals,
        allowedMealTypes,
        rules,
        allowDailyVariation
      }`,
      { name }
    );
    if (!doc || typeof doc !== "object") return null;
    const n = normPlanName((doc as any).name);
    if (!n) return null;
    const price = Number((doc as any).price);
    const allowedNew = Array.isArray((doc as any).allowedMeals) ? (doc as any).allowedMeals : [];
    const allowedLegacy = Array.isArray((doc as any).allowedMealTypes) ? (doc as any).allowedMealTypes : [];
    const allowedRaw = allowedNew.length ? allowedNew : allowedLegacy;
    const allowedMeals = allowedRaw.map((x: unknown) => normalizeMealTypeKey(x)).filter(Boolean);
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

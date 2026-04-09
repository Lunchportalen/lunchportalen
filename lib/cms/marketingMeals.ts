import "server-only";

import { getProductPlan } from "@/lib/cms/getProductPlan";
import { getMenusByMealTypes } from "@/lib/cms/getMenusByMealTypes";
import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { FALLBACK_BASIS_MEAL_KEYS, FALLBACK_LUXUS_MEAL_KEYS } from "@/lib/cms/mealTierFallback";

function norList(labels: string[]): string {
  const f = labels.map((s) => String(s ?? "").trim()).filter(Boolean);
  if (!f.length) return "";
  if (f.length === 1) return f[0];
  if (f.length === 2) return `${f[0]} og ${f[1]}`;
  return `${f.slice(0, -1).join(", ")} og ${f[f.length - 1]}`;
}

export async function mealDisplayLabelsForPlan(plan: "basis" | "luxus"): Promise<string[]> {
  try {
    const pp = await getProductPlan(plan);
    const keysRaw =
      pp?.allowedMeals?.length ?
        pp.allowedMeals
      : plan === "basis" ?
        [...FALLBACK_BASIS_MEAL_KEYS]
      : [...FALLBACK_LUXUS_MEAL_KEYS];
    const keys = keysRaw.map((x) => normalizeMealTypeKey(x)).filter(Boolean);
    const menus = await getMenusByMealTypes(keys);
    return keys.map((k) => displayLabelForMealTypeKey(k, menus.get(k)));
  } catch (e: unknown) {
    console.warn("[cms/marketingMeals] mealDisplayLabelsForPlan failed", String((e as { message?: string })?.message ?? e));
    const keys =
      plan === "basis" ?
        [...FALLBACK_BASIS_MEAL_KEYS].map((k) => normalizeMealTypeKey(k)).filter(Boolean)
      : [...FALLBACK_LUXUS_MEAL_KEYS].map((k) => normalizeMealTypeKey(k)).filter(Boolean);
    return keys.map((k) => displayLabelForMealTypeKey(k, null));
  }
}

export type HomePricingFromCms = {
  basisLine: string;
  luxusLine: string;
  basisPrice: number;
  luxusPrice: number;
};

/**
 * Forside / pris-seksjon: menytekst fra CMS productPlan + menu.title; priser fra productPlan.
 */
export async function homePricingCopyFromCms(): Promise<HomePricingFromCms> {
  const fallbackPrices = { basis: 90, luxus: 130 };
  try {
    const [ppB, ppL] = await Promise.all([getProductPlan("basis"), getProductPlan("luxus")]);
    const priceB =
      ppB?.price && Number.isFinite(ppB.price) && ppB.price > 0 ? ppB.price : fallbackPrices.basis;
    const priceL =
      ppL?.price && Number.isFinite(ppL.price) && ppL.price > 0 ? ppL.price : fallbackPrices.luxus;

    const bk = (ppB?.allowedMeals?.length ? ppB.allowedMeals : [...FALLBACK_BASIS_MEAL_KEYS])
      .map((x) => normalizeMealTypeKey(x))
      .filter(Boolean);
    const lk = (ppL?.allowedMeals?.length ? ppL.allowedMeals : [...FALLBACK_LUXUS_MEAL_KEYS])
      .map((x) => normalizeMealTypeKey(x))
      .filter(Boolean);
    const menus = await getMenusByMealTypes([...new Set([...bk, ...lk])]);
    const basisLabels = bk.map((k) => displayLabelForMealTypeKey(k, menus.get(k)));
    const bset = new Set(bk);
    const extraKeys = lk.filter((k) => !bset.has(k));
    const extraLabels = extraKeys.map((k) => displayLabelForMealTypeKey(k, menus.get(k)));

    const basisLine = `${norList(basisLabels)}.`;
    const luxusLine =
      extraLabels.length ? `${norList(basisLabels)} + ${norList(extraLabels)}.` : `${norList(basisLabels)}.`;

    return { basisLine, luxusLine, basisPrice: priceB, luxusPrice: priceL };
  } catch (e: unknown) {
    console.warn("[cms/marketingMeals] homePricingCopyFromCms failed", String((e as { message?: string })?.message ?? e));
    const b = await mealDisplayLabelsForPlan("basis");
    const l = await mealDisplayLabelsForPlan("luxus");
    const extra = l.length > b.length ? l.slice(b.length) : [];
    const basisLine = `${norList(b)}.`;
    const luxusLine = extra.length ? `${norList(b)} + ${norList(extra)}.` : `${norList(l)}.`;
    return {
      basisLine,
      luxusLine,
      basisPrice: fallbackPrices.basis,
      luxusPrice: fallbackPrices.luxus,
    };
  }
}

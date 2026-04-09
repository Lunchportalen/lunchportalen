// STATUS: KEEP

import "server-only";

import type { CmsMenuByMealType } from "@/lib/cms/types";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { getMenusByMealTypes } from "@/lib/cms/getMenusByMealTypes";
import { sanity } from "@/lib/sanity/client";
import { normalizeMenuDoc } from "@/lib/cms/normalizeMenuDoc";

export async function getMenuByMealType(mealType: string): Promise<CmsMenuByMealType | null> {
  const k = normalizeMealTypeKey(mealType);
  if (!k) return null;
  const map = await getMenusByMealTypes([k]);
  return map.get(k) ?? null;
}

/** Direct fetch (single); prefer batch getMenusByMealTypes in hot paths. */
export async function getMenuByMealTypeDirect(mealType: string): Promise<CmsMenuByMealType | null> {
  const k = normalizeMealTypeKey(mealType);
  if (!k) return null;
  try {
    const doc = await sanity.fetch(
      `*[_type == "menu" && mealType == $mealType][0]{
        mealType,
        title,
        description,
        allergens,
        nutrition,
        variants,
        "imageUrls": images[].asset->url,
        "legacyImageUrl": image.asset->url
      }`,
      { mealType: k }
    );
    return normalizeMenuDoc(doc);
  } catch (e: any) {
    console.warn("[cms/getMenuByMealTypeDirect] fetch failed", { mealType: k, detail: String(e?.message ?? e) });
    return null;
  }
}

export { normalizeMenuDoc } from "@/lib/cms/normalizeMenuDoc";

import "server-only";

import { sanity } from "@/lib/sanity/client";
import type { CmsMenuByMealType } from "@/lib/cms/types";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { normalizeMenuDoc } from "@/lib/cms/normalizeMenuDoc";

export async function getMenusByMealTypes(mealTypes: string[]): Promise<Map<string, CmsMenuByMealType>> {
  const out = new Map<string, CmsMenuByMealType>();
  const keys = Array.from(new Set(mealTypes.map((x) => normalizeMealTypeKey(x)).filter(Boolean)));
  if (!keys.length) return out;

  try {
    const rows = await sanity.fetch(
      `*[_type == "menu" && mealType in $mealTypes]{
        mealType,
        title,
        description,
        allergens,
        nutrition,
        variants,
        "imageUrls": images[].asset->url,
        "legacyImageUrl": image.asset->url
      }`,
      { mealTypes: keys }
    );
    const list = Array.isArray(rows) ? rows : [];
    for (const row of list) {
      const m = normalizeMenuDoc(row);
      if (m) out.set(m.mealType, m);
    }
  } catch (e: any) {
    console.warn("[cms/getMenusByMealTypes] fetch failed", { detail: String(e?.message ?? e) });
  }

  return out;
}

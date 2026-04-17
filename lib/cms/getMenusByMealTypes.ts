import "server-only";

import { sanity } from "@/lib/sanity/client";
import type { CmsMenuByMealType } from "@/lib/cms/types";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { normalizeMenuDoc } from "@/lib/cms/normalizeMenuDoc";
import { opsLog } from "@/lib/ops/log";

export type MenusByMealTypesFetchResult = {
  map: Map<string, CmsMenuByMealType>;
  /** True when Sanity fetch threw — map may be empty; callers should not treat as «ingen meny publisert». */
  fetchFailed: boolean;
};

export async function getMenusByMealTypesWithFetchStatus(mealTypes: string[]): Promise<MenusByMealTypesFetchResult> {
  const out = new Map<string, CmsMenuByMealType>();
  const keys = Array.from(new Set(mealTypes.map((x) => normalizeMealTypeKey(x)).filter(Boolean)));
  if (!keys.length) return { map: out, fetchFailed: false };

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
    return { map: out, fetchFailed: false };
  } catch (e: any) {
    const detail = String(e?.message ?? e);
    opsLog("cms.menu.fetch_failed", {
      surface: "getMenusByMealTypes",
      mealTypeKeyCount: keys.length,
      detail,
    });
    return { map: out, fetchFailed: true };
  }
}

export async function getMenusByMealTypes(mealTypes: string[]): Promise<Map<string, CmsMenuByMealType>> {
  const { map } = await getMenusByMealTypesWithFetchStatus(mealTypes);
  return map;
}

import "server-only";

import { getProductPlan } from "@/lib/cms/getProductPlan";
import { getMenusByMealTypes } from "@/lib/cms/getMenusByMealTypes";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import type { FirmaOnboardingCmsBundle } from "@/lib/onboarding/cmsBundleTypes";

export type { FirmaOnboardingCmsBundle };

export async function loadFirmaOnboardingCms(): Promise<FirmaOnboardingCmsBundle | null> {
  try {
    const [b, l] = await Promise.all([getProductPlan("basis"), getProductPlan("luxus")]);
    if (!b || !l) return null;
    const all = [...new Set([...b.allowedMeals, ...l.allowedMeals].map((x) => normalizeMealTypeKey(x)).filter(Boolean))];
    const menus = await getMenusByMealTypes(all);
    const menuTitles: Record<string, string> = {};
    for (const k of all) {
      const nk = normalizeMealTypeKey(k);
      const m = menus.get(nk);
      const t = m?.title != null ? String(m.title).trim() : "";
      if (t) menuTitles[nk] = t;
    }
    return {
      basis: { price: b.price, allowedMeals: b.allowedMeals },
      luxus: { price: l.price, allowedMeals: l.allowedMeals },
      menuTitles,
    };
  } catch (e: any) {
    console.warn("[onboarding/loadFirmaOnboardingCms] failed", String(e?.message ?? e));
    return null;
  }
}

import "server-only";

import { buildMenuDayCategories } from "@/app/api/order/window/route";
import { getMenuForDateAndPlan, type MenuDay } from "@/lib/cms/menuDay";
import { getLunchCategoryStaticItemsByPlanTier, getLunchCategoryStaticItemsByPlanTierForProvider } from "@/lib/cms/lunchCategory";
import type { PlanTier } from "@/lib/cms/menuDayContract";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { menuDayQueryOptsFromScope, type MenuScopeDecision } from "@/lib/menu/providerMenuScope";

export type ResolveOrderDayItemResult =
  | { ok: true; item_key: string | null; item_title_snapshot: string | null }
  | { ok: false; status: number; code: string; message: string };

function normChoiceKey(key: string): string {
  const n = normalizeMealTypeKey(key);
  return (n || key.trim()).toLowerCase();
}

/**
 * Bestemmer `item_key` + `item_title_snapshot` for day_choices ut fra publisert menuDay.
 * Client `itemTitle` brukes ikke — snapshot er alltid server-side.
 *
 * `menuScope` (provider-scope, server truth):
 * - "scoped": menuDay leses kun for providerens slug.
 * - "fail-closed": menuDay hentes IKKE (aldri en annen providers meny) —
 *   statisk lunchCategory-katalog (globalt delt innhold) brukes alene.
 * - utelatt / "legacy-unscoped": dagens (globale) lesing beholdes.
 */
export async function resolveOrderDayItemPersist(params: {
  date: string;
  planTier: PlanTier;
  choiceKey: string;
  clientItemKey: string | null;
  menuScope?: MenuScopeDecision;
}): Promise<ResolveOrderDayItemResult> {
  let menus: MenuDay[] = [];
  if (params.menuScope?.mode !== "fail-closed") {
    try {
      menus = await getMenuForDateAndPlan(
        params.date,
        params.planTier,
        params.menuScope?.mode === "scoped" ? menuDayQueryOptsFromScope(params.menuScope) : undefined,
      );
    } catch {
      return {
        ok: false,
        status: 503,
        code: "MENU_LOOKUP_FAILED",
        message: "Menyinnhold er midlertidig utilgjengelig — prøv igjen.",
      };
    }
  }

  const staticItemsByCategory =
    params.menuScope?.mode === "scoped"
      ? await getLunchCategoryStaticItemsByPlanTierForProvider(params.menuScope.providerId, params.planTier)
      : await getLunchCategoryStaticItemsByPlanTier(params.planTier);
  const categories = buildMenuDayCategories({ planTier: params.planTier, menus, staticItemsByCategory });
  const want = normChoiceKey(params.choiceKey);
  const cat = categories.find((c) => normChoiceKey(c.key) === want);

  const items = Array.isArray(cat?.items) ? cat!.items : [];
  if (items.length >= 2) {
    const raw = params.clientItemKey?.trim();
    if (!raw) {
      return {
        ok: false,
        status: 400,
        code: "ITEM_CHOICE_REQUIRED",
        message: "Item-valg påkrevd for denne kategorien.",
      };
    }
    const low = raw.toLowerCase();
    const hit = items.find((it) => String(it.key).trim().toLowerCase() === low);
    if (!hit) {
      return {
        ok: false,
        status: 400,
        code: "INVALID_ITEM_CHOICE",
        message: "Ugyldig item-valg for kategorien.",
      };
    }
    const snap = String(hit.title ?? hit.key).trim() || hit.key;
    return { ok: true, item_key: String(hit.key).trim(), item_title_snapshot: snap };
  }

  /* items.length 0–1: ingen item-lagring (støtter varmrett/sushi m.m.) */
  return { ok: true, item_key: null, item_title_snapshot: null };
}

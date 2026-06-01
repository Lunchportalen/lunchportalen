import "server-only";

import type { CmsMenuByMealType } from "@/lib/cms/types";
import { getLunchCategoryStaticItemsByPlanTier } from "@/lib/cms/lunchCategory";
import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";
import { ORDER_CHOICE_KEY_BY_CATEGORY, type Category, type PlanTier } from "@/lib/cms/menuDayContract";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

/** `${normalizeMealTypeKey(choiceKey)}:${itemKeyLower}` → display title */
export type VariantTitleLookup = Map<string, string>;

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build slug→title map from Sanity lunchCategory (all plan tiers).
 * Used by kitchen to resolve day_choices.item_key (CMS variant slug).
 */
export async function buildVariantTitleLookup(): Promise<VariantTitleLookup> {
  const tiers: PlanTier[] = ["BASIS", "LUXUS", "ENTERPRISE"];
  const out = new Map<string, string>();

  for (const tier of tiers) {
    const staticByCat = await getLunchCategoryStaticItemsByPlanTier(tier);
    for (const cat of Object.keys(ORDER_CHOICE_KEY_BY_CATEGORY) as Category[]) {
      const choiceKey = ORDER_CHOICE_KEY_BY_CATEGORY[cat];
      const nk = normalizeMealTypeKey(choiceKey);
      const items = staticByCat[cat];
      if (!items?.length) continue;
      for (const it of items) {
        const ik = safeStr(it.key).toLowerCase();
        if (!ik) continue;
        const title = safeStr(it.title) || ik;
        out.set(`${nk}:${ik}`, title);
        out.set(`${choiceKey.toLowerCase()}:${ik}`, title);
      }
    }
  }

  return out;
}

export function resolveVariantTitleFromLookup(
  choiceKey: string,
  itemKey: string | null | undefined,
  lookup: VariantTitleLookup,
): string | null {
  const ik = safeStr(itemKey).toLowerCase();
  if (!ik) return null;
  const nk = normalizeMealTypeKey(choiceKey);
  return lookup.get(`${nk}:${ik}`) ?? lookup.get(`${safeStr(choiceKey).toLowerCase()}:${ik}`) ?? null;
}

/** Legacy: variant embedded in day_choices.note as "Label: variant". */
export function parseVariantFromLegacyNote(
  choiceKey: string,
  note: string | null,
  menuByMeal: Map<string, CmsMenuByMealType>,
): string | null {
  const n = safeStr(note);
  if (!n) return null;

  const parts = n.split("||").map((x) => x.trim()).filter(Boolean);
  const payload = parts.length >= 2 ? parts.slice(1).join("||").trim() : (parts[0] ?? "");

  const nk = normalizeMealTypeKey(choiceKey);
  const label = displayLabelForMealTypeKey(nk, nk ? menuByMeal.get(nk) : null);
  if (!label) return null;

  const re = new RegExp(`^${escapeRegExp(label)}\\s*:\\s*(.+)$`, "i");
  const m = re.exec(payload);
  const v = m?.[1] ? String(m[1]).trim() : "";
  return v || null;
}

/**
 * Kitchen-facing meal line: category label + optional variant in parentheses.
 * Priority: item_title_snapshot → item_key CMS lookup → legacy note parse.
 */
export function buildKitchenMealNote(params: {
  choiceKey: string | null;
  itemKey?: string | null;
  itemTitleSnapshot?: string | null;
  note?: string | null;
  menuByMeal: Map<string, CmsMenuByMealType>;
  variantLookup?: VariantTitleLookup;
}): string | null {
  const ck = safeStr(params.choiceKey).toLowerCase();
  if (!ck) return null;

  const nk = normalizeMealTypeKey(ck);
  const base =
    displayLabelForMealTypeKey(nk || ck, nk ? params.menuByMeal.get(nk) : null) || nk || ck;

  const snap = safeStr(params.itemTitleSnapshot);
  const fromKey =
    params.variantLookup && params.itemKey
      ? resolveVariantTitleFromLookup(ck, params.itemKey, params.variantLookup)
      : null;
  const fromNote = parseVariantFromLegacyNote(nk || ck, params.note ?? null, params.menuByMeal);

  const variant = snap || fromKey || fromNote;
  if (variant) return `${base} (${variant})`;
  return base;
}

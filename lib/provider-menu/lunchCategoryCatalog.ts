// Client-safe mapping: Sanity lunchCategory rows → provider menu catalog (same source as employee/order).

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { CATEGORY_LABELS } from "@/lib/cms/menuDayContract";
import { PROVIDER_MENU_CATEGORY_ORDER } from "@/lib/provider-menu/menuCategoryCanonical";
import { isSanityDrivenCategory } from "@/lib/provider-menu/providerMenuTierContract";

export const LUNCH_CATEGORY_ALLERGENS = [  "hvete",
  "melk",
  "egg",
  "fisk",
  "peanotter",
  "soya",
  "sesam",
  "krepsdyr",
  "sennep",
  "kasjunott",
] as const;

export const EDITABLE_LUNCH_CATEGORY_KEYS = [
  "paasmurt",
  "salatboks",
  "sushi",
  "pokebowl",
  "thaimat",
  "vegetarian",
] as const;

export type EditableLunchCategoryKey = (typeof EDITABLE_LUNCH_CATEGORY_KEYS)[number];

export const CATALOG_WEEK_PUBLISH_HINT =
  "Endringer i katalogen gjelder fra neste ukespublisering for uke-/kjøkkenvisning. Ordre-vindu oppdateres umiddelbart.";
export type ProviderLunchCategoryItemRow = {
  key: string;
  title: string;
  description?: string | null;
  allergens?: string[] | null;
  isVegetarian?: boolean | null;
  allowedPlanTiers?: string[] | null;
  /** WS-4: aktiv bestilling låser endring/fjerning/omdøping */
  orderLocked?: boolean;
};

export type ProviderLunchCategoryRow = {
  key: string | null;
  title?: string | null;
  allowedPlanTiers?: string[] | null;
  items?: ProviderLunchCategoryItemRow[] | null;
  /** Provider-scoped lunchCategory doc exists for this category key. */
  isProviderScoped?: boolean;
};

export type ProviderMenuCatalogSnapshot = {
  rows: ProviderLunchCategoryRow[];
};

export const EMPTY_PROVIDER_MENU_CATALOG: ProviderMenuCatalogSnapshot = { rows: [] };

const PLAN_TIERS: PlanTier[] = ["BASIS", "LUXUS", "ENTERPRISE"];

export function categoryFromLunchCategoryKey(k: string | null | undefined): Category | null {
  const s = String(k ?? "")
    .trim()
    .toLowerCase();
  if (!s) return null;
  if (s === "paasmurt") return "paasmurt";
  if (s === "salatboks") return "salat";
  if (s === "sushi") return "sushi";
  if (s === "pokebowl") return "pokebowl";
  if (s === "thaimat") return "thai";
  if (s === "vegetarian") return "vegetarian";
  if (s === "varmrett") return "varmrett";
  return null;
}

function tierAllowed(allowed: string[] | null | undefined, tier: PlanTier): boolean {
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  const tierUpper = tier.toUpperCase();
  return allowed.some((t) => String(t).trim().toUpperCase() === tierUpper);
}

export function categoryRowForCategory(
  catalog: ProviderMenuCatalogSnapshot,
  category: Category,
): ProviderLunchCategoryRow | null {
  for (const row of catalog.rows) {
    if (categoryFromLunchCategoryKey(row.key) === category) return row;
  }
  return null;
}

export function categoryLabelFromCatalog(
  catalog: ProviderMenuCatalogSnapshot,
  category: Category,
  profileCategoryLabels?: Partial<Record<Category, string>>,
): string {
  const profileLabel = profileCategoryLabels?.[category];
  if (profileLabel) return profileLabel;

  const row = categoryRowForCategory(catalog, category);
  const title = String(row?.title ?? "").trim();
  if (title) return title;
  return CATEGORY_LABELS[category];
}

export function workspaceCategoriesFromCatalog(catalog: ProviderMenuCatalogSnapshot, tier: PlanTier): Category[] {
  const allowed = new Set<Category>();
  for (const row of catalog.rows) {
    const cat = categoryFromLunchCategoryKey(row.key);
    if (!cat) continue;
    if (!tierAllowed(row.allowedPlanTiers, tier)) continue;
    allowed.add(cat);
  }
  return PROVIDER_MENU_CATEGORY_ORDER.filter((c) => allowed.has(c));
}

export type CatalogFixedVariant = {
  key: string;
  title: string;
  isVegetarian?: boolean;
  allergens: string[];
};

export function fixedVariantsFromCatalog(
  catalog: ProviderMenuCatalogSnapshot,
  tier: PlanTier,
  category: Category,
): CatalogFixedVariant[] {
  if (isSanityDrivenCategory(category)) return [];

  const row = categoryRowForCategory(catalog, category);
  if (!row || !tierAllowed(row.allowedPlanTiers, tier)) return [];

  const rawItems = Array.isArray(row.items) ? row.items : [];
  const out: CatalogFixedVariant[] = [];

  for (const item of rawItems) {
    if (!item || typeof item !== "object") continue;
    const key = String(item.key ?? "").trim();
    if (!key) continue;
    if (!tierAllowed(item.allowedPlanTiers ?? row.allowedPlanTiers, tier)) continue;

    const title = String(item.title ?? "").trim() || key;
    const allergens = Array.isArray(item.allergens) ? item.allergens.map((a) => String(a)) : [];
    out.push({
      key,
      title,
      isVegetarian: item.isVegetarian === true,
      allergens,
    });
  }

  return out;
}

export function tierAccessForCategoryRow(row: ProviderLunchCategoryRow): PlanTier[] {
  const allowed = Array.isArray(row.allowedPlanTiers) ? row.allowedPlanTiers : [];
  if (allowed.length === 0) return [...PLAN_TIERS];
  return PLAN_TIERS.filter((t) => tierAllowed(allowed, t));
}

export function tierAccessForItem(
  item: ProviderLunchCategoryItemRow,
  categoryRow: ProviderLunchCategoryRow,
): PlanTier[] {
  const itemTiers = Array.isArray(item.allowedPlanTiers) ? item.allowedPlanTiers : [];
  if (itemTiers.length > 0) {
    return PLAN_TIERS.filter((t) => tierAllowed(itemTiers, t));
  }
  return tierAccessForCategoryRow(categoryRow);
}

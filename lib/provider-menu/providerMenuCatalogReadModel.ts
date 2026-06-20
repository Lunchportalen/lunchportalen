// lib/provider-menu/providerMenuCatalogReadModel.ts
// Provider menu catalog read-model — source: live Sanity lunchCategory (same as employee/order).

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { isSanityDrivenCategory } from "@/lib/provider-menu/providerMenuTierContract";
import {
  categoryFromLunchCategoryKey,
  categoryLabelFromCatalog,
  fixedVariantsFromCatalog,
  tierAccessForCategoryRow,
  tierAccessForItem,
  type ProviderLunchCategoryRow,
  type ProviderMenuCatalogSnapshot,
} from "@/lib/provider-menu/lunchCategoryCatalog";

import { CATALOG_WEEK_PUBLISH_HINT } from "@/lib/provider-menu/lunchCategoryCatalog";

export const CATALOG_PERSISTENCE_GAP = CATALOG_WEEK_PUBLISH_HINT;

export const EMPLOYEE_WEEK_IMAGE_GAP =
  "Employee /week image rendering bør tas i egen PR — bilder er valgfritt i menybyggeren.";

export type MenuCatalogSource = "SANITY_LUNCH_CATEGORY" | "SANITY" | "PROVIDER_OVERRIDE";

export type MenuCatalogVariant = {
  id: string;
  category: Category;
  categoryLabel: string;
  label: string;
  description: string | null;
  allergens: string[];
  imageUrl: string | null;
  active: boolean;
  tierAccess: PlanTier[];
  source: MenuCatalogSource;
  isVegetarian?: boolean;
};

export function normalizeProviderLunchCategoryRows(raw: unknown): ProviderLunchCategoryRow[] {
  if (!Array.isArray(raw)) return [];
  const out: ProviderLunchCategoryRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const itemsRaw = o.items;
    const items: ProviderLunchCategoryRow["items"] = [];
    if (Array.isArray(itemsRaw)) {
      for (const item of itemsRaw) {
        if (!item || typeof item !== "object") continue;
        const it = item as Record<string, unknown>;
        const key = String(it.key ?? "").trim();
        if (!key) continue;
        items.push({
          key,
          title: String(it.title ?? "").trim() || key,
          description: typeof it.description === "string" ? it.description : null,
          allergens: Array.isArray(it.allergens) ? it.allergens.map((a) => String(a)) : [],
          isVegetarian: it.isVegetarian === true,
          allowedPlanTiers: Array.isArray(it.allowedPlanTiers)
            ? it.allowedPlanTiers.map((t) => String(t))
            : null,
        });
      }
    }
    out.push({
      key: o.key != null ? String(o.key) : null,
      title: o.title != null ? String(o.title) : null,
      allowedPlanTiers: Array.isArray(o.allowedPlanTiers) ? o.allowedPlanTiers.map((t) => String(t)) : null,
      items,
    });
  }
  return out;
}

export function buildMenuCatalogSnapshot(rows: unknown): ProviderMenuCatalogSnapshot {
  return { rows: normalizeProviderLunchCategoryRows(rows) };
}

export function buildMenuCatalogVariants(catalog: ProviderMenuCatalogSnapshot): MenuCatalogVariant[] {
  const out: MenuCatalogVariant[] = [];

  for (const row of catalog.rows) {
    const category = categoryFromLunchCategoryKey(row.key);
    if (!category) continue;

    const categoryLabel = categoryLabelFromCatalog(catalog, category);

    if (isSanityDrivenCategory(category)) {
      out.push({
        id: `${category}:bank`,
        category,
        categoryLabel,
        label: "Dagens varmrett",
        description: "Rullerende rett fra Sanity/bank — ny per dag.",
        allergens: [],
        imageUrl: null,
        active: true,
        tierAccess: tierAccessForCategoryRow(row),
        source: "SANITY",
      });
      continue;
    }

    const rawItems = Array.isArray(row.items) ? row.items : [];
    for (const item of rawItems) {
      if (!item) continue;
      const key = String(item.key ?? "").trim();
      if (!key) continue;
      const tierAccess = tierAccessForItem(item, row);
      if (tierAccess.length === 0) continue;

      out.push({
        id: `${category}:${key}`,
        category,
        categoryLabel,
        label: String(item.title ?? "").trim() || key,
        description: item.description ?? null,
        allergens: Array.isArray(item.allergens) ? item.allergens.map((a) => String(a)) : [],
        imageUrl: null,
        active: true,
        tierAccess,
        source: "SANITY_LUNCH_CATEGORY",
        isVegetarian: item.isVegetarian === true,
      });
    }
  }

  return out;
}

export function catalogVariantsForTier(
  catalog: ProviderMenuCatalogSnapshot,
  tier: PlanTier,
): MenuCatalogVariant[] {
  return buildMenuCatalogVariants(catalog).filter((v) => v.tierAccess.includes(tier));
}

export function catalogVariantByKey(
  catalog: ProviderMenuCatalogSnapshot,
  category: Category,
  variantKey: string,
): MenuCatalogVariant | null {
  return buildMenuCatalogVariants(catalog).find(
    (v) => v.category === category && v.id === `${category}:${variantKey}`,
  ) ?? null;
}

export function catalogSupportsPersistentEdit(): boolean {
  return true;
}

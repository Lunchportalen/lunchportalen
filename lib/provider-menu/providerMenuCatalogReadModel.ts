// lib/provider-menu/providerMenuCatalogReadModel.ts
// Fixed-variant catalog read-model for provider menu workspace.
// Source: scripts/sanity/seed-lunch-categories-v2.ts — no provider-persistent storage yet.

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import {
  CATEGORY_VARIANT_CONTRACT,
  fixedVariantsForCategory,
  isSanityDrivenCategory,
  tierIncludesCategory,
  workspaceCategoriesForTier,
} from "@/lib/provider-menu/providerMenuTierContract";

export const CATALOG_PERSISTENCE_GAP =
  "Varig katalogredigering krever egen lagringsmodell — metadata vises som masterdata, men lagres ikke varig i denne versjonen.";

export const EMPLOYEE_WEEK_IMAGE_GAP =
  "Employee /week image rendering bør tas i egen PR — bilder er valgfritt i menybyggeren.";

export type MenuCatalogSource = "FIXED_CONTRACT" | "SANITY" | "PROVIDER_OVERRIDE";

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

/** Allergen slugs from seed-lunch-categories-v2.ts (read-only mirror). */
const SEED_ALLERGENS: Record<string, string[]> = {
  "ost-skinke": ["hvete", "melk"],
  "laks-egger": ["hvete", "egg", "fisk"],
  "kylling-karri": ["hvete", "melk", "sennep"],
  vegetar: ["hvete", "melk", "egg", "sennep"],
  skinke: ["melk", "egg", "sennep"],
  kylling: ["egg", "melk", "sennep"],
  "sushi-pakke": ["fisk", "soya", "hvete", "sesam", "krepsdyr"],
  laks: ["fisk", "soya", "sesam"],
  "pad-thai-nudler": ["peanotter", "soya", "egg", "fisk"],
  "biff-peppersaus": ["soya", "sesam", "hvete"],
  "pad-med-mamuang": ["kasjunott", "soya", "sesam"],
};

const TIER_ORDER: PlanTier[] = ["BASIS", "LUXUS", "ENTERPRISE"];

function tiersForCategory(category: Category): PlanTier[] {
  return TIER_ORDER.filter((tier) => tierIncludesCategory(tier, category));
}

export function buildMenuCatalogVariants(): MenuCatalogVariant[] {
  const out: MenuCatalogVariant[] = [];

  for (const contract of Object.values(CATEGORY_VARIANT_CONTRACT)) {
    if (isSanityDrivenCategory(contract.category)) {
      out.push({
        id: `${contract.category}:bank`,
        category: contract.category,
        categoryLabel: contract.categoryLabel,
        label: "Dagens varmmatrett",
        description: "Rullerende rett fra Sanity/bank — ny per dag.",
        allergens: [],
        imageUrl: null,
        active: true,
        tierAccess: tiersForCategory(contract.category),
        source: "SANITY",
      });
      continue;
    }

    for (const variant of contract.variants) {
      out.push({
        id: `${contract.category}:${variant.key}`,
        category: contract.category,
        categoryLabel: contract.categoryLabel,
        label: variant.title,
        description: null,
        allergens: SEED_ALLERGENS[variant.key] ?? [],
        imageUrl: null,
        active: true,
        tierAccess: tiersForCategory(contract.category),
        source: "FIXED_CONTRACT",
        isVegetarian: variant.isVegetarian,
      });
    }
  }

  return out;
}

export function catalogVariantsForTier(tier: PlanTier): MenuCatalogVariant[] {
  const allowed = new Set(workspaceCategoriesForTier(tier));
  return buildMenuCatalogVariants().filter((v) => allowed.has(v.category));
}

export function catalogVariantByKey(category: Category, variantKey: string): MenuCatalogVariant | null {
  return buildMenuCatalogVariants().find((v) => v.category === category && v.id === `${category}:${variantKey}`) ?? null;
}

export function catalogSupportsPersistentEdit(): boolean {
  return false;
}

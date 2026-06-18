// lib/provider-menu/basisMenuContract.ts
// Original fixed Basis/Luxus menu variants — sourced from repo truth, not invented.
//
// Primary source: scripts/sanity/seed-lunch-categories-v2.ts
// Commits: c7450d01 (item-level allowedPlanTiers), da12237d (menuDay items + allergens)
// Secondary: studio/schemaTypes/menuDay.ts (editorial documentation)
// Secondary: studio/schemaTypes/lunchCategory.ts (category keys)

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import { PROVIDER_MENU_CATEGORY_ORDER } from "@/lib/provider-menu/menuCategoryCanonical";

export const BASIS_MENU_CONTRACT_SOURCE = "scripts/sanity/seed-lunch-categories-v2.ts";

export type FixedMenuVariant = {
  key: string;
  title: string;
  isVegetarian?: boolean;
};

export type ProviderMenuCategoryContract = {
  category: Category;
  categoryLabel: string;
  lunchCategoryKey: string;
  /** true = daily title from Sanity menuDay (varmrett). false = fixed lunchCategory variants. */
  sanityDriven: boolean;
  variants: FixedMenuVariant[];
  /** Tiers where category appears in Sanity seed allowedPlanTiers. */
  seedAllowedTiers: PlanTier[];
};

/**
 * Full fixed menu catalog mirrored from seed-lunch-categories-v2.ts.
 * Titles use seed values; display aliases (e.g. «Fast meny») applied in catalog surface.
 */
export const PROVIDER_MENU_CATEGORY_CONTRACTS: readonly ProviderMenuCategoryContract[] = [
  {
    category: "paasmurt",
    categoryLabel: "Påsmurt",
    lunchCategoryKey: "paasmurt",
    sanityDriven: false,
    seedAllowedTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
    variants: [
      { key: "ost-skinke", title: "Ost & skinke" },
      { key: "kylling-karri", title: "Kylling karri" },
      { key: "vegetar", title: "Vegetar", isVegetarian: true },
    ],
  },
  {
    category: "salat",
    categoryLabel: "Salatboks",
    lunchCategoryKey: "salatboks",
    sanityDriven: false,
    seedAllowedTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
    variants: [
      { key: "skinke", title: "Skinke" },
      { key: "kylling", title: "Kylling" },
      { key: "vegetar", title: "Vegetar", isVegetarian: true },
    ],
  },
  {
    category: "sushi",
    categoryLabel: "Sushi",
    lunchCategoryKey: "sushi",
    sanityDriven: false,
    seedAllowedTiers: ["LUXUS", "ENTERPRISE"],
    variants: [{ key: "sushi-pakke", title: "Fast meny" }],
  },
  {
    category: "pokebowl",
    categoryLabel: "Pokebowl",
    lunchCategoryKey: "pokebowl",
    sanityDriven: false,
    seedAllowedTiers: ["LUXUS", "ENTERPRISE"],
    variants: [
      { key: "laks", title: "Laks" },
      { key: "kylling", title: "Kylling" },
      { key: "vegetar", title: "Vegetar", isVegetarian: true },
    ],
  },
  {
    category: "thai",
    categoryLabel: "Thaimat",
    lunchCategoryKey: "thaimat",
    sanityDriven: false,
    seedAllowedTiers: ["LUXUS", "ENTERPRISE"],
    variants: [
      { key: "pad-thai-nudler", title: "Pad Thai" },
      { key: "pad-med-mamuang", title: "Pad med mamuang" },
      { key: "biff-peppersaus", title: "Biff peppersaus" },
    ],
  },
  {
    category: "varmrett",
    categoryLabel: "Varmmat",
    lunchCategoryKey: "varmrett",
    sanityDriven: true,
    seedAllowedTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
    variants: [],
  },
] as const;

/**
 * Provider Basis workspace shows the full fixed catalog (all six categories).
 * Forensic note: Sanity seed marks sushi/pokebowl/thai as LUXUS-only for ordering,
 * but the provider menu planner must surface the complete structure with fixed variants.
 */
export const PROVIDER_BASIS_WORKSPACE_CATEGORIES: Category[] = [...PROVIDER_MENU_CATEGORY_ORDER];

export function contractForCategory(category: Category): ProviderMenuCategoryContract | null {
  return PROVIDER_MENU_CATEGORY_CONTRACTS.find((c) => c.category === category) ?? null;
}

export function workspaceCategoriesForTier(tier: PlanTier): Category[] {
  if (tier === "BASIS") return PROVIDER_BASIS_WORKSPACE_CATEGORIES;
  return PROVIDER_MENU_CATEGORY_ORDER.filter((category) => {
    const contract = contractForCategory(category);
    return contract?.seedAllowedTiers.includes(tier) ?? false;
  });
}

export function fixedVariantsForCategory(category: Category): FixedMenuVariant[] {
  return contractForCategory(category)?.variants ?? [];
}

export function isSanityDrivenCategory(category: Category): boolean {
  return contractForCategory(category)?.sanityDriven === true;
}

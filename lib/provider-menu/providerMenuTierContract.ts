// lib/provider-menu/providerMenuTierContract.ts
// Authoritative Basis/Luxus/Enterprise menu tier contract for provider menu builder.
//
// Source: scripts/sanity/seed-lunch-categories-v2.ts (commits c7450d01, da12237d)
// Tier category sets mirror lib/cms/menuDayContract.ts PLAN_CATEGORIES.

import { PLAN_CATEGORIES, type Category, type PlanTier } from "@/lib/cms/menuDayContract";
import { categoriesForTierInOrder } from "@/lib/provider-menu/menuCategoryCanonical";

export const MENU_TIER_CONTRACT_SOURCE = "scripts/sanity/seed-lunch-categories-v2.ts";

export type ProviderMenuTier = PlanTier;

export type FixedMenuVariant = {
  key: string;
  title: string;
  isVegetarian?: boolean;
};

export type ProviderMenuCategoryContract = {
  category: Category;
  categoryLabel: string;
  lunchCategoryKey: string;
  /** true = daily title from Sanity/bank (varmrett). */
  sanityDriven: boolean;
  variants: FixedMenuVariant[];
};

/** Fixed variant catalog — product order, never alphabetical. */
export const CATEGORY_VARIANT_CONTRACT: Record<Category, ProviderMenuCategoryContract> = {
  paasmurt: {
    category: "paasmurt",
    categoryLabel: "Påsmurt",
    lunchCategoryKey: "paasmurt",
    sanityDriven: false,
    variants: [
      { key: "ost-skinke", title: "Ost & Skinke" },
      { key: "laks-eggerore", title: "Laks & Eggerøre" },
      { key: "kylling-karri", title: "Kyllingkarri" },
      { key: "vegetar", title: "Vegetar", isVegetarian: true },
    ],
  },
  salat: {
    category: "salat",
    categoryLabel: "Salatboks",
    lunchCategoryKey: "salatboks",
    sanityDriven: false,
    variants: [
      { key: "skinke", title: "Skinke" },
      { key: "kylling", title: "Kylling" },
      { key: "vegetar", title: "Vegetar", isVegetarian: true },
    ],
  },
  sushi: {
    category: "sushi",
    categoryLabel: "Sushi",
    lunchCategoryKey: "sushi",
    sanityDriven: false,
    variants: [
      {
        key: "sushi-pakke",
        title: "Fast pakke: 6 maki + 2 nigiri + 1 tempura",
      },
    ],
  },
  pokebowl: {
    category: "pokebowl",
    categoryLabel: "Pokébowl",
    lunchCategoryKey: "pokebowl",
    sanityDriven: false,
    variants: [
      { key: "laks", title: "Laks" },
      { key: "kylling", title: "Kylling" },
      { key: "vegetar", title: "Vegetar", isVegetarian: true },
    ],
  },
  thai: {
    category: "thai",
    categoryLabel: "Thaimat",
    lunchCategoryKey: "thaimat",
    sanityDriven: false,
    variants: [
      { key: "pad-thai-nudler", title: "Pad Thai nudler" },
      { key: "biff-peppersaus", title: "Biff peppersaus wok" },
      { key: "pad-med-mamuang", title: "Pad med mamuang wok" },
    ],
  },
  varmrett: {
    category: "varmrett",
    categoryLabel: "Varmrett",
    lunchCategoryKey: "varmrett",
    sanityDriven: true,
    variants: [],
  },
};

export const PROVIDER_MENU_CATEGORY_CONTRACTS: readonly ProviderMenuCategoryContract[] = [
  CATEGORY_VARIANT_CONTRACT.paasmurt,
  CATEGORY_VARIANT_CONTRACT.salat,
  CATEGORY_VARIANT_CONTRACT.sushi,
  CATEGORY_VARIANT_CONTRACT.pokebowl,
  CATEGORY_VARIANT_CONTRACT.thai,
  CATEGORY_VARIANT_CONTRACT.varmrett,
];

/** Basis = Påsmurt + Salatboks + Varmrett only. */
export const BASIS_WORKSPACE_CATEGORIES: Category[] = categoriesForTierInOrder(PLAN_CATEGORIES.BASIS);

/** Luxus & Enterprise = all six categories. */
export const LUXUS_WORKSPACE_CATEGORIES: Category[] = categoriesForTierInOrder(PLAN_CATEGORIES.LUXUS);

export const ENTERPRISE_WORKSPACE_CATEGORIES: Category[] = categoriesForTierInOrder(PLAN_CATEGORIES.ENTERPRISE);

export const ENTERPRISE_TIER_MODEL = {
  inheritsFrom: "LUXUS" as const,
  requiresUpgrade: true,
  priceExVatNok: 170,
  priceIncVatNok: 195.5,
  vatRate: 0.15,
  upgradeTypes: [
    "PREMIUM_PROTEIN",
    "EXTRA_SIDE",
    "DESSERT_FRUIT",
    "LARGER_PORTION",
    "PREMIUM_LABELING",
    "PRIORITY_DELIVERY",
    "OTHER",
  ] as const,
};

export function contractForCategory(category: Category): ProviderMenuCategoryContract | null {
  return CATEGORY_VARIANT_CONTRACT[category] ?? null;
}

export function workspaceCategoriesForTier(tier: PlanTier): Category[] {
  switch (tier) {
    case "BASIS":
      return BASIS_WORKSPACE_CATEGORIES;
    case "LUXUS":
      return LUXUS_WORKSPACE_CATEGORIES;
    case "ENTERPRISE":
      return ENTERPRISE_WORKSPACE_CATEGORIES;
    default:
      return [];
  }
}

export function fixedVariantsForCategory(category: Category): FixedMenuVariant[] {
  return contractForCategory(category)?.variants ?? [];
}

export function isSanityDrivenCategory(category: Category): boolean {
  return contractForCategory(category)?.sanityDriven === true;
}

export function tierIncludesCategory(tier: PlanTier, category: Category): boolean {
  return workspaceCategoriesForTier(tier).includes(category);
}

/**
 * PHASE 17MENU — Canonical global package category keys.
 * Language/locale must never change these identities.
 */

export const PACKAGE_KEYS = ["BASIS", "LUXUS", "ENTERPRISE"] as const;
export type PackageKey = (typeof PACKAGE_KEYS)[number];

/** Stable package category keys (global; independent of language). */
export const CANONICAL_PACKAGE_CATEGORIES = [
  "sandwich",
  "salad_box",
  "warm_meal",
  "sushi",
  "poke_bowl",
  "thai",
  "enterprise_upgrade",
] as const;

export type CanonicalPackageCategory = (typeof CANONICAL_PACKAGE_CATEGORIES)[number];

export const ORDERABLE_PACKAGE_CATEGORIES = [
  "sandwich",
  "salad_box",
  "warm_meal",
  "sushi",
  "poke_bowl",
  "thai",
] as const;

export type OrderablePackageCategory = (typeof ORDERABLE_PACKAGE_CATEGORIES)[number];

export const PACKAGE_CANONICAL_CATEGORIES: Record<PackageKey, readonly CanonicalPackageCategory[]> = {
  BASIS: ["sandwich", "salad_box", "warm_meal"],
  LUXUS: ["sandwich", "salad_box", "warm_meal", "sushi", "poke_bowl", "thai"],
  ENTERPRISE: [
    "sandwich",
    "salad_box",
    "warm_meal",
    "sushi",
    "poke_bowl",
    "thai",
    "enterprise_upgrade",
  ],
};

export const PACKAGE_ORDERABLE_CATEGORIES: Record<PackageKey, readonly OrderablePackageCategory[]> = {
  BASIS: ["sandwich", "salad_box", "warm_meal"],
  LUXUS: ["sandwich", "salad_box", "warm_meal", "sushi", "poke_bowl", "thai"],
  ENTERPRISE: ["sandwich", "salad_box", "warm_meal", "sushi", "poke_bowl", "thai"],
};

/** Norway CMS category slug (menuDay.category). */
export type NorwayCmsCategory =
  | "paasmurt"
  | "salat"
  | "sushi"
  | "pokebowl"
  | "thai"
  | "vegetarian"
  | "varmrett";

/** Norway employee order choice_key. */
export type NorwayOrderChoiceKey =
  | "paasmurt"
  | "salatboks"
  | "sushi"
  | "pokebowl"
  | "thaimat"
  | "vegetarian"
  | "varmmat";

const CANONICAL_TO_NO_CMS: Record<OrderablePackageCategory, NorwayCmsCategory> = {
  sandwich: "paasmurt",
  salad_box: "salat",
  warm_meal: "varmrett",
  sushi: "sushi",
  poke_bowl: "pokebowl",
  thai: "thai",
};

const CANONICAL_TO_NO_ORDER: Record<OrderablePackageCategory, NorwayOrderChoiceKey> = {
  sandwich: "paasmurt",
  salad_box: "salatboks",
  warm_meal: "varmmat",
  sushi: "sushi",
  poke_bowl: "pokebowl",
  thai: "thaimat",
};

const NO_ORDER_TO_CANONICAL: Record<string, OrderablePackageCategory> = {
  paasmurt: "sandwich",
  salatboks: "salad_box",
  varmmat: "warm_meal",
  sushi: "sushi",
  pokebowl: "poke_bowl",
  thaimat: "thai",
};

const NO_CMS_TO_CANONICAL: Record<string, OrderablePackageCategory> = {
  paasmurt: "sandwich",
  salat: "salad_box",
  salatboks: "salad_box",
  varmrett: "warm_meal",
  sushi: "sushi",
  pokebowl: "poke_bowl",
  thai: "thai",
  thaimat: "thai",
};

/** Legacy entitlement suffix → canonical (dual-read). */
const LEGACY_ENTITLEMENT_TO_CANONICAL: Record<string, CanonicalPackageCategory> = {
  paasmurt: "sandwich",
  salat: "salad_box",
  salatboks: "salad_box",
  varmrett: "warm_meal",
  warm_meal: "warm_meal",
  sushi: "sushi",
  pokebowl: "poke_bowl",
  poke_bowl: "poke_bowl",
  thai: "thai",
  thaimat: "thai",
  sandwich: "sandwich",
  salad_box: "salad_box",
  enterprise_upgrade: "enterprise_upgrade",
  auto_warm_meal: "warm_meal",
};

export function asPackageKey(value: unknown): PackageKey | null {
  const k = String(value ?? "").trim().toUpperCase();
  return PACKAGE_KEYS.includes(k as PackageKey) ? (k as PackageKey) : null;
}

export function asCanonicalPackageCategory(value: unknown): CanonicalPackageCategory | null {
  const k = String(value ?? "").trim().toLowerCase();
  return CANONICAL_PACKAGE_CATEGORIES.includes(k as CanonicalPackageCategory)
    ? (k as CanonicalPackageCategory)
    : null;
}

export function norwayCmsCategoryForCanonical(cat: OrderablePackageCategory): NorwayCmsCategory {
  return CANONICAL_TO_NO_CMS[cat];
}

export function norwayOrderChoiceForCanonical(cat: OrderablePackageCategory): NorwayOrderChoiceKey {
  return CANONICAL_TO_NO_ORDER[cat];
}

export function canonicalFromNorwayOrderChoice(choiceKey: string): OrderablePackageCategory | null {
  return NO_ORDER_TO_CANONICAL[String(choiceKey ?? "").trim().toLowerCase()] ?? null;
}

export function canonicalFromNorwayCmsCategory(cms: string): OrderablePackageCategory | null {
  return NO_CMS_TO_CANONICAL[String(cms ?? "").trim().toLowerCase()] ?? null;
}

export function canonicalFromEntitlementKey(entitlementKey: string): CanonicalPackageCategory | null {
  const raw = String(entitlementKey ?? "").trim().toLowerCase();
  if (raw === "enterprise_upgrade") return "enterprise_upgrade";
  if (raw === "auto_warm_meal") return "warm_meal";
  const suffix = raw.startsWith("menu_category:") ? raw.slice("menu_category:".length) : raw;
  return LEGACY_ENTITLEMENT_TO_CANONICAL[suffix] ?? asCanonicalPackageCategory(suffix);
}

export function entitlementKeyForCanonical(cat: CanonicalPackageCategory): string {
  if (cat === "enterprise_upgrade") return "enterprise_upgrade";
  return `menu_category:${cat}`;
}

export function packageAllowsCanonical(
  packageKey: PackageKey,
  category: CanonicalPackageCategory,
): boolean {
  return PACKAGE_CANONICAL_CATEGORIES[packageKey].includes(category);
}

export function packageAllowsOrderable(
  packageKey: PackageKey,
  category: OrderablePackageCategory,
): boolean {
  return PACKAGE_ORDERABLE_CATEGORIES[packageKey].includes(category);
}

export function isOrderableCanonical(category: CanonicalPackageCategory): category is OrderablePackageCategory {
  return (ORDERABLE_PACKAGE_CATEGORIES as readonly string[]).includes(category);
}

/** Norwegian UI labels (presentation only). */
export const NORWAY_CANONICAL_LABELS: Record<CanonicalPackageCategory, string> = {
  sandwich: "Påsmurt",
  salad_box: "Salatboks",
  warm_meal: "Varmrett",
  sushi: "Sushi",
  poke_bowl: "Pokébowl",
  thai: "Thaimat",
  enterprise_upgrade: "Enterprise-oppgradering",
};

// lib/provider-menu/menuCategoryCanonical.ts
// Canonical menu category keys for provider menu builder (client-safe).

import { CATEGORIES, type Category } from "@/lib/cms/menuDayContract";

/** Stable display order — never sort alphabetically. */
export const PROVIDER_MENU_CATEGORY_ORDER: readonly Category[] = [
  "paasmurt",
  "salat",
  "sushi",
  "pokebowl",
  "thai",
  "vegetarian",
  "varmrett",
] as const;

const CATEGORY_ALIASES: Record<string, Category> = {
  paasmurt: "paasmurt",
  påsmurt: "paasmurt",
  pasmurt: "paasmurt",
  salat: "salat",
  salatbar: "salat",
  salatboks: "salat",
  salad: "salat",
  sushi: "sushi",
  pokebowl: "pokebowl",
  poke: "pokebowl",
  "pokébowl": "pokebowl",
  thai: "thai",
  thaimat: "thai",
  vegetarian: "vegetarian",
  vegetar: "vegetarian",
  vegetarisk: "vegetarian",
  varmrett: "varmrett",
  varmmat: "varmrett",
  warm_meal: "varmrett",
  warmmeal: "varmrett",
};

function foldAliasKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, "");
}

/**
 * Maps legacy/alias category keys to canonical menuDay category.
 * Returns null when the value cannot be mapped safely.
 */
export function canonicalMenuCategory(value: unknown): Category | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const lowered = raw.toLowerCase();
  if (CATEGORIES.includes(lowered as Category)) return lowered as Category;

  const folded = foldAliasKey(raw);
  const hit = CATEGORY_ALIASES[folded];
  if (hit) return hit;

  return null;
}

export function categoriesForTierInOrder(tierCategories: readonly Category[]): Category[] {
  const allowed = new Set(tierCategories);
  return PROVIDER_MENU_CATEGORY_ORDER.filter((c) => allowed.has(c));
}

export function isPlaceholderMenuTitle(title: unknown): boolean {
  const t = String(title ?? "").trim();
  return !t || t === "Utkast" || t === "—" || t === "-";
}

export function menuSlotHasContent(input: {
  mealTitle?: unknown;
  description?: unknown;
  docId?: string | null;
}): boolean {
  const title = String(input.mealTitle ?? "").trim();
  const description = String(input.description ?? "").trim();
  if (input.docId && !isPlaceholderMenuTitle(title)) return true;
  if (!isPlaceholderMenuTitle(title) && title.length >= 2) return true;
  if (!isPlaceholderMenuTitle(description) && description.length >= 8) return true;
  return false;
}

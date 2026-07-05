/**
 * Map generator allergen codes to menuDay allergen strings (locale-aware display).
 */

import type { AllergenCode, MenuLocale } from "@/lib/menu-generator/types";

const ALLERGEN_LABELS_NB: Record<AllergenCode, string> = {
  gluten: "Gluten",
  melk: "Melk",
  egg: "Egg",
  fisk: "Fisk",
  skalldyr: "Skalldyr",
  soya: "Soya",
  sesam: "Sesam",
  selleri: "Selleri",
  sennep: "Sennep",
  nøtter: "Nøtter",
  peanøtter: "Peanøtter",
  sulfitt: "Sulfitt",
  lupin: "Lupin",
  bløtdyr: "Bløtdyr",
};

const LOCALE_ALLERGEN_OVERRIDES: Partial<Record<MenuLocale, Partial<Record<AllergenCode, string>>>> = {
  "de-DE": {
    gluten: "Gluten",
    melk: "Milch",
    egg: "Ei",
    fisk: "Fisch",
    skalldyr: "Krebstiere",
    nøtter: "Nüsse",
    peanøtter: "Erdnüsse",
  },
  "sv-SE": {
    melk: "Mjölk",
    egg: "Ägg",
    fisk: "Fisk",
    skalldyr: "Skaldjur",
    nøtter: "Nötter",
  },
  "da-DK": {
    melk: "Mælk",
    egg: "Æg",
    fisk: "Fisk",
    skalldyr: "Skaldyr",
    nøtter: "Nødder",
  },
  "en-GB": {
    melk: "Milk",
    egg: "Egg",
    fisk: "Fish",
    skalldyr: "Crustaceans",
    nøtter: "Nuts",
    peanøtter: "Peanuts",
  },
};

export function formatAllergensForMenuDay(
  allergens: readonly AllergenCode[],
  menuLocale: MenuLocale,
): string {
  const overrides = LOCALE_ALLERGEN_OVERRIDES[menuLocale] ?? {};
  const labels = allergens.map((code) => overrides[code] ?? ALLERGEN_LABELS_NB[code] ?? code);
  return labels.join(", ");
}

export function normalizeAllergenListForCompare(values: readonly string[]): string {
  return [...values]
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join("|");
}

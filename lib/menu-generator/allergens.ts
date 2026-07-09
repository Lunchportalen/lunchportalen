import type { AllergenCode } from "@/lib/menu-generator/types";

/** Canonical internal allergen list — employee-visible, provider-authored. */
export const CANONICAL_ALLERGENS: readonly AllergenCode[] = [
  "gluten",
  "melk",
  "egg",
  "fisk",
  "skalldyr",
  "soya",
  "sesam",
  "selleri",
  "sennep",
  "nøtter",
  "peanøtter",
  "sulfitt",
  "lupin",
  "bløtdyr",
] as const;

export function normalizeAllergens(raw: readonly string[]): AllergenCode[] {
  const allowed = new Set<string>(CANONICAL_ALLERGENS);
  return raw.filter((a): a is AllergenCode => allowed.has(a));
}

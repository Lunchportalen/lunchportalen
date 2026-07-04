import type {
  AllergenCode,
  FixedCategoryKey,
  FixedDishDefinition,
  MenuLocale,
} from "@/lib/menu-generator/types";

export type CompactDishRow =
  | [FixedCategoryKey, string, string, string, readonly AllergenCode[]]
  | [FixedCategoryKey, string, string, string, readonly AllergenCode[], readonly string[]]
  | [FixedCategoryKey, string, string, string, readonly AllergenCode[], readonly string[], number];

export function expandLocaleBank(locale: MenuLocale, rows: readonly CompactDishRow[]): FixedDishDefinition[] {
  return rows.map((row) => {
    const [categoryKey, slug, title, description, allergens, tags, score] = row;
    return {
      menuLocale: locale,
      categoryKey,
      slug,
      title,
      description,
      allergens,
      tags: tags ?? [],
      localCultureScore: score ?? 8,
      enabledByDefault: true,
    };
  });
}

export function countByCategory(
  bank: readonly FixedDishDefinition[],
): Record<FixedCategoryKey, number> {
  const out = {} as Record<FixedCategoryKey, number>;
  for (const dish of bank) {
    out[dish.categoryKey] = (out[dish.categoryKey] ?? 0) + 1;
  }
  return out;
}

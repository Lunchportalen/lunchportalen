/**
 * Mirrors lp_order_set MSDI category slug resolution (app choice_key → product_categories.name slug).
 * Keep in sync with supabase migration lp_order_set_varmmat_msdi_alias and product_categories seed names.
 */

/** product_categories.name values (syncMenuServiceDayItems LUNCH_CATEGORY_KEY_TO_DB_NAME). */
const PRODUCT_CATEGORY_NAMES = ["Paasmurt", "Salatboks", "Sushi", "Pokebowl", "Thaimat", "Vegetarian", "Varmrett"] as const;

/** Slugs from product_categories.name (same transform as lp_order_set). */
export function productCategoryNameToMsdiSlug(name: string): string {
  const s = String(name ?? "").trim();
  const translated = s
    .replace(/æ/gi, "e")
    .replace(/ø/gi, "o")
    .replace(/å/gi, "a");
  return translated.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export const MSDI_CATEGORY_SLUGS: readonly string[] = PRODUCT_CATEGORY_NAMES.map(productCategoryNameToMsdiSlug);

/** choice_key / note head → slug used in MSDI item lookup (not day_choices storage). */
export function choiceKeyToMsdiCategorySlug(choiceRaw: string): string {
  const slug = String(choiceRaw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, "");
  if (slug === "varmmat") return "varmrett";
  if (slug === "vegetar" || slug === "vegetarisk") return "vegetarian";
  return slug;
}

export function msdiSlugResolvesInCatalog(slug: string, catalog: readonly string[] = MSDI_CATEGORY_SLUGS): boolean {
  return catalog.includes(slug);
}

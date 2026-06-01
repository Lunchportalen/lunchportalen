/**
 * Employee-facing label for an ACTIVE order line.
 * Variant title priority matches kitchen `buildKitchenMealNote`:
 * item_title_snapshot → CMS menuDay.items slug lookup (never raw slug alone).
 */

export type OrderedMealCategoryItem = {
  key: string;
  title: string;
};

export type OrderedMealCategory = {
  key: string;
  label: string;
  items: OrderedMealCategoryItem[];
};

export type OrderedMealChoice = {
  key: string;
  label: string;
};

export type OrderedMealDayInput = {
  orderStatus: "ACTIVE" | "CANCELLED" | null;
  selectedChoiceKey: string | null;
  selectedItemKey: string | null;
  selectedItemTitleSnapshot: string | null;
  categories: OrderedMealCategory[];
  allowedChoices: OrderedMealChoice[];
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

export function resolveVariantTitleFromMenuItems(
  choiceKey: string,
  itemKey: string | null | undefined,
  categories: OrderedMealCategory[],
): string | null {
  const ik = safeStr(itemKey).toLowerCase();
  if (!ik) return null;
  const ck = safeStr(choiceKey).toLowerCase();
  const cat = categories.find((c) => safeStr(c.key).toLowerCase() === ck);
  if (!cat?.items?.length) return null;
  const hit = cat.items.find((it) => safeStr(it.key).toLowerCase() === ik);
  const title = hit ? safeStr(hit.title) : "";
  return title || null;
}

/** «Kategori – variant» for ACTIVE; null when not ordered or missing choice. */
export function buildOrderedMealDisplayLine(day: OrderedMealDayInput): string | null {
  if (day.orderStatus !== "ACTIVE") return null;
  const ck = safeStr(day.selectedChoiceKey).toLowerCase();
  if (!ck) return null;

  const cat = day.categories.find((c) => safeStr(c.key).toLowerCase() === ck);
  const categoryLabel =
    (cat ? safeStr(cat.label) : "") ||
    day.allowedChoices.find((c) => safeStr(c.key).toLowerCase() === ck)?.label ||
    ck;

  const snap = safeStr(day.selectedItemTitleSnapshot);
  const fromMenu = resolveVariantTitleFromMenuItems(ck, day.selectedItemKey, day.categories);
  const variant = snap || fromMenu;
  if (variant) return `${categoryLabel} – ${variant}`;
  return categoryLabel;
}

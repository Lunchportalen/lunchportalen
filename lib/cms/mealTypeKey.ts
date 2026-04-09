/**
 * Canonical mealType keys align with orders.day_choices.choice_key (ASCII).
 * CMS / human input may use "påsmurt" — normalize before lookups.
 */
export function normalizeMealTypeKey(raw: unknown): string {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFC");
  if (!s) return "";
  if (s === "påsmurt" || s === "pasmurt") return "paasmurt";
  return s.replace(/\s+/g, "");
}

export function mealTypeKeysEqual(a: unknown, b: unknown): boolean {
  return normalizeMealTypeKey(a) === normalizeMealTypeKey(b);
}

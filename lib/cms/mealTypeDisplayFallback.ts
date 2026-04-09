/**
 * Client-safe display labels when Sanity `menu` docs are missing or unreachable.
 * Canonical keys match DB `choice_key` / normalized mealType (ASCII: paasmurt).
 */
export const MEAL_TYPE_DISPLAY_LABEL_FALLBACK: Record<string, string> = {
  salatbar: "Salatbar",
  paasmurt: "Påsmurt",
  varmmat: "Varmmat",
  sushi: "Sushi",
  pokebowl: "Pokébowl",
  thaimat: "Thaimat",
};

export function displayLabelForMealTypeKey(key: string, menu?: { title?: string | null } | null): string {
  const t = menu?.title != null ? String(menu.title).trim() : "";
  if (t) return t;
  const k = String(key ?? "")
    .trim()
    .toLowerCase();
  return MEAL_TYPE_DISPLAY_LABEL_FALLBACK[k] || k;
}

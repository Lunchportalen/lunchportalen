/** EU-14 allergen codes (DB enum lp_allergen_code). Norwegian labels for UI only. */

export const LP_ALLERGEN_CODES = [
  "gluten",
  "crustaceans",
  "egg",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "tree_nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;

export type LpAllergenCode = (typeof LP_ALLERGEN_CODES)[number];

export const LP_ALLERGEN_LABELS_NB: Record<LpAllergenCode, string> = {
  gluten: "Gluten",
  crustaceans: "Skalldyr",
  egg: "Egg",
  fish: "Fisk",
  peanuts: "Peanøtter",
  soy: "Soya",
  milk: "Melk",
  tree_nuts: "Nøtter",
  celery: "Selleri",
  mustard: "Sennep",
  sesame: "Sesam",
  sulphites: "Sulfitt",
  lupin: "Lupin",
  molluscs: "Bløtdyr",
};

export const LP_USER_ALLERGEN_FREE_TEXT_MAX = 280;

export type LpUserAllergenProfile = {
  user_id: string;
  codes: LpAllergenCode[];
  free_text: string;
  updated_at: string | null;
};

const CODE_SET = new Set<string>(LP_ALLERGEN_CODES);

export function normalizeLpAllergenCodes(raw: unknown): LpAllergenCode[] {
  if (!Array.isArray(raw)) return [];
  const out: LpAllergenCode[] = [];
  for (const item of raw) {
    const k = String(item ?? "").trim() as LpAllergenCode;
    if (CODE_SET.has(k) && !out.includes(k)) out.push(k);
  }
  return out;
}

export function normalizeLpAllergenFreeText(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .slice(0, LP_USER_ALLERGEN_FREE_TEXT_MAX);
}

export function formatLpAllergenCodesForKitchen(codes: LpAllergenCode[]): string {
  return codes.map((c) => LP_ALLERGEN_LABELS_NB[c]).join(", ");
}

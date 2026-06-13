/** EU-14 allergen codes + Mattilsynet undertyper (DB enum lp_allergen_code). Norwegian labels for UI only. */

/** Top-level EU-14 categories shown as primary chips in the employee form. */
export const LP_ALLERGEN_CATEGORY_CODES = [
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

export type LpAllergenCategoryCode = (typeof LP_ALLERGEN_CATEGORY_CODES)[number];

/** Mattilsynet: kornslag when gluten is selected. Parent `gluten` = uspesifisert / vet ikke. */
export const LP_GLUTEN_SUBTYPE_CODES = [
  "gluten_wheat",
  "gluten_rye",
  "gluten_barley",
  "gluten_oats",
  "gluten_spelt",
  "gluten_kamut",
] as const;

export type LpGlutenSubtypeCode = (typeof LP_GLUTEN_SUBTYPE_CODES)[number];

/** Mattilsynet: nøttetype when tree_nuts is selected. Parent `tree_nuts` = uspesifisert / vet ikke. */
export const LP_TREE_NUT_SUBTYPE_CODES = [
  "nut_almond",
  "nut_hazelnut",
  "nut_walnut",
  "nut_cashew",
  "nut_pecan",
  "nut_pistachio",
  "nut_brazil",
  "nut_macadamia",
] as const;

export type LpTreeNutSubtypeCode = (typeof LP_TREE_NUT_SUBTYPE_CODES)[number];

export type LpAllergenSubtypeCode = LpGlutenSubtypeCode | LpTreeNutSubtypeCode;

/** All valid DB / API codes (categories + undertyper). */
export const LP_ALLERGEN_CODES = [
  ...LP_ALLERGEN_CATEGORY_CODES,
  ...LP_GLUTEN_SUBTYPE_CODES,
  ...LP_TREE_NUT_SUBTYPE_CODES,
] as const;

export type LpAllergenCode = (typeof LP_ALLERGEN_CODES)[number];

/** @deprecated Use LP_ALLERGEN_CATEGORY_CODES for primary form chips. Kept for import stability. */
export { LP_ALLERGEN_CATEGORY_CODES as LP_ALLERGEN_EU14_CODES };

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
  gluten_wheat: "Hvete",
  gluten_rye: "Rug",
  gluten_barley: "Bygg",
  gluten_oats: "Havre",
  gluten_spelt: "Spelt",
  gluten_kamut: "Kamut",
  nut_almond: "Mandel",
  nut_hazelnut: "Hasselnøtt",
  nut_walnut: "Valnøtt",
  nut_cashew: "Cashewnøtt",
  nut_pecan: "Pekannøtt",
  nut_pistachio: "Pistachio",
  nut_brazil: "Paranøtt",
  nut_macadamia: "Macadamianøtt",
};

export const LP_USER_ALLERGEN_FREE_TEXT_MAX = 280;

export type LpUserAllergenProfile = {
  user_id: string;
  codes: LpAllergenCode[];
  free_text: string;
  updated_at: string | null;
};

/** Kitchen + print: explicit safety state per employee (never ambiguous blank). */
export type KitchenEmployeeAllergenProfileStatus = "has_data" | "declared_empty" | "unknown";

export type LpUserAllergenRowLike = {
  codes?: unknown;
  free_text?: unknown;
};

export function resolveEmployeeAllergenProfileStatus(
  row: LpUserAllergenRowLike | null | undefined,
): KitchenEmployeeAllergenProfileStatus {
  if (row == null) return "unknown";
  const codes = normalizeLpAllergenCodes(row.codes);
  const text = normalizeLpAllergenFreeText(row.free_text);
  if (codes.length > 0 || text.length > 0) return "has_data";
  return "declared_empty";
}

const CODE_SET = new Set<string>(LP_ALLERGEN_CODES);
const GLUTEN_SUBTYPE_SET = new Set<string>(LP_GLUTEN_SUBTYPE_CODES);
const TREE_NUT_SUBTYPE_SET = new Set<string>(LP_TREE_NUT_SUBTYPE_CODES);

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

/** Kitchen/print: prefer specific undertyper over uspesifisert parent when both are stored. */
export function allergenCodesForKitchenDisplay(codes: LpAllergenCode[]): LpAllergenCode[] {
  const normalized = normalizeLpAllergenCodes(codes);
  const hasGlutenSubtype = normalized.some((c) => GLUTEN_SUBTYPE_SET.has(c));
  const hasNutSubtype = normalized.some((c) => TREE_NUT_SUBTYPE_SET.has(c));
  return normalized.filter((c) => {
    if (c === "gluten" && hasGlutenSubtype) return false;
    if (c === "tree_nuts" && hasNutSubtype) return false;
    return true;
  });
}

export function labelLpAllergenCodeForKitchen(code: LpAllergenCode): string {
  return LP_ALLERGEN_LABELS_NB[code];
}

export function formatLpAllergenCodesForKitchen(codes: LpAllergenCode[]): string {
  return allergenCodesForKitchenDisplay(codes).map((c) => labelLpAllergenCodeForKitchen(c)).join(", ");
}

export function isGlutenSubtypeCode(code: LpAllergenCode): code is LpGlutenSubtypeCode {
  return GLUTEN_SUBTYPE_SET.has(code);
}

export function isTreeNutSubtypeCode(code: LpAllergenCode): code is LpTreeNutSubtypeCode {
  return TREE_NUT_SUBTYPE_SET.has(code);
}

export function stripGlutenSubtypes(codes: LpAllergenCode[]): LpAllergenCode[] {
  return codes.filter((c) => !isGlutenSubtypeCode(c));
}

export function stripTreeNutSubtypes(codes: LpAllergenCode[]): LpAllergenCode[] {
  return codes.filter((c) => !isTreeNutSubtypeCode(c));
}

/** Client GET: unknown = never saved (no updated_at); declared_empty = saved empty row. */
export function resolveEmployeeAllergenProfileStatusFromClientProfile(
  profile: LpUserAllergenProfile | null | undefined,
): KitchenEmployeeAllergenProfileStatus {
  if (!profile) return "unknown";
  const codes = normalizeLpAllergenCodes(profile.codes);
  const text = normalizeLpAllergenFreeText(profile.free_text);
  if (codes.length > 0 || text.length > 0) return "has_data";
  if (profile.updated_at) return "declared_empty";
  return "unknown";
}

/** Collapsed disclosure summary chips, e.g. «Gluten (hvete)», «Melk». */
export function formatLpAllergenDisclosureSummaryItems(codes: LpAllergenCode[]): string[] {
  const normalized = normalizeLpAllergenCodes(codes);
  const items: string[] = [];

  for (const cat of LP_ALLERGEN_CATEGORY_CODES) {
    if (cat === "gluten") {
      const subs = normalized.filter(isGlutenSubtypeCode);
      if (subs.length > 0) {
        for (const sub of subs) {
          items.push(`Gluten (${LP_ALLERGEN_LABELS_NB[sub].toLowerCase()})`);
        }
      } else if (normalized.includes("gluten")) {
        items.push("Gluten");
      }
      continue;
    }
    if (cat === "tree_nuts") {
      const subs = normalized.filter(isTreeNutSubtypeCode);
      if (subs.length > 0) {
        for (const sub of subs) {
          items.push(`Nøtter (${LP_ALLERGEN_LABELS_NB[sub].toLowerCase()})`);
        }
      } else if (normalized.includes("tree_nuts")) {
        items.push("Nøtter");
      }
      continue;
    }
    if (normalized.includes(cat)) {
      items.push(LP_ALLERGEN_LABELS_NB[cat]);
    }
  }

  return items;
}

export const PLAN_TIERS = ["BASIS", "LUXUS", "ENTERPRISE"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const CATEGORIES = ["paasmurt", "salat", "sushi", "pokebowl", "thai", "vegetarian", "varmrett"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  paasmurt: "Påsmurt",
  salat: "Salat",
  sushi: "Sushi",
  pokebowl: "Pokébowl",
  thai: "Thai",
  vegetarian: "Vegetar",
  varmrett: "Varmrett",
};

export const PLAN_CATEGORIES: Record<PlanTier, Category[]> = {
  BASIS: ["paasmurt", "salat", "varmrett"],
  LUXUS: ["paasmurt", "salat", "sushi", "pokebowl", "thai", "vegetarian", "varmrett"],
  ENTERPRISE: ["paasmurt", "salat", "sushi", "pokebowl", "thai", "vegetarian", "varmrett"],
};

export const ORDER_CHOICE_KEY_BY_CATEGORY: Record<Category, string> = {
  paasmurt: "paasmurt",
  salat: "salatboks",
  sushi: "sushi",
  pokebowl: "pokebowl",
  thai: "thaimat",
  vegetarian: "vegetarian",
  varmrett: "varmmat",
};

export const PLAN_ORDER_CHOICE_KEYS: Record<PlanTier, string[]> = {
  BASIS: PLAN_CATEGORIES.BASIS.map((category) => ORDER_CHOICE_KEY_BY_CATEGORY[category]),
  LUXUS: PLAN_CATEGORIES.LUXUS.map((category) => ORDER_CHOICE_KEY_BY_CATEGORY[category]),
  ENTERPRISE: PLAN_CATEGORIES.ENTERPRISE.map((category) => ORDER_CHOICE_KEY_BY_CATEGORY[category]),
};

export function asPlanTier(value: unknown): PlanTier | null {
  const tier = String(value ?? "").trim().toUpperCase();
  return PLAN_TIERS.includes(tier as PlanTier) ? (tier as PlanTier) : null;
}

/** Sanity allergen slug → norsk EU 1169/2011-etikett (26 entries, FASE 10C.2). */
export const ALLERGEN_DISPLAY_LABELS: Record<string, string> = {
  hvete: "Hvete",
  rug: "Rug",
  bygg: "Bygg",
  havre: "Havre",
  spelt: "Spelt",
  kamut: "Kamut",
  krepsdyr: "Krepsdyr",
  blotdyr: "Bløtdyr",
  egg: "Egg",
  fisk: "Fisk",
  peanotter: "Peanøtter",
  soya: "Soya",
  melk: "Melk",
  mandel: "Mandel",
  hasselnott: "Hasselnøtt",
  valnott: "Valnøtt",
  kasjunott: "Kasjunøtt",
  pekan: "Pekan",
  paranott: "Paranøtt",
  pistasj: "Pistasj",
  makadamia: "Makadamia",
  selleri: "Selleri",
  sennep: "Sennep",
  sesam: "Sesamfrø",
  sulfitter: "Sulfitter",
  lupin: "Lupin",
};

export function displayAllergens(keys: readonly string[]): string {
  if (!Array.isArray(keys) || keys.length === 0) return "";
  return keys.map((k) => ALLERGEN_DISPLAY_LABELS[k] ?? k).join(", ");
}

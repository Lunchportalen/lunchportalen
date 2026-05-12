export const PLAN_TIERS = ["BASIS", "LUXUS", "ENTERPRISE"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const CATEGORIES = ["paasmurt", "salat", "sushi", "pokebowl", "thai", "varmrett"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  paasmurt: "Påsmurt",
  salat: "Salat",
  sushi: "Sushi",
  pokebowl: "Pokébowl",
  thai: "Thai",
  varmrett: "Varmrett",
};

export const PLAN_CATEGORIES: Record<PlanTier, Category[]> = {
  BASIS: ["paasmurt", "salat", "varmrett"],
  LUXUS: ["paasmurt", "salat", "sushi", "pokebowl", "thai", "varmrett"],
  ENTERPRISE: ["paasmurt", "salat", "sushi", "pokebowl", "thai", "varmrett"],
};

export const ORDER_CHOICE_KEY_BY_CATEGORY: Record<Category, string> = {
  paasmurt: "paasmurt",
  salat: "salatbar",
  sushi: "sushi",
  pokebowl: "pokebowl",
  thai: "thaimat",
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

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

export function asPlanTier(value: unknown): PlanTier | null {
  const tier = String(value ?? "").trim().toUpperCase();
  return PLAN_TIERS.includes(tier as PlanTier) ? (tier as PlanTier) : null;
}

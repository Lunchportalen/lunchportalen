/**
 * PHASE 17MENU.2A — Extended production-ready recipe contract.
 * Status promotions are never automatic.
 */
import {
  COMMISSION_DENOMINATOR,
  COMMISSION_RATE_BPS,
  commissionExactNumerator,
} from "@/lib/billing/exactCommissionBps";
import type { IngredientScalingType, ProductionReadyRecipe } from "@/lib/menu/productionReadyRecipe";

export type RecipeLifecycleStatus =
  | "meal_idea"
  | "structured_recipe_draft"
  | "kitchen_reviewed"
  | "generation_eligible"
  | "provider_approved"
  | "published_week_plan_item"
  | "rejected";

export type CostBasis =
  | "provider_actual"
  | "supplier_catalog"
  | "country_benchmark"
  | "estimate_requiring_provider_review";

export type StructuredProductionRecipe = ProductionReadyRecipe & {
  source_meal_idea_id: string;
  status: RecipeLifecycleStatus;
  created_at: string;
  reviewed_at: string | null;
  ingredients: Array<
    ProductionReadyRecipe["ingredients"][number] & {
      local_name: string;
      cost_currency: string;
      cost_basis: CostBasis;
      benchmark_source: string;
      benchmark_date: string;
    }
  >;
  delivery: ProductionReadyRecipe["delivery"] & {
    garnish_separation: boolean;
    sauce_separation_risk: "low" | "medium" | "high";
  };
  economics: ProductionReadyRecipe["economics"] & {
    provider_price_context_minor: number;
    currency: string;
    cost_basis: CostBasis;
    commission_rate_bps: typeof COMMISSION_RATE_BPS;
    commission_denominator: typeof COMMISSION_DENOMINATOR;
  };
  menu_quality: ProductionReadyRecipe["menu_quality"] & {
    vegetarian: boolean;
    vegan: boolean;
    local_relevance_rationale: string;
  };
};

export const MANDATORY_STRUCTURED_FIELDS = [
  "dish_key",
  "country_code",
  "recipe_version",
  "source_meal_idea_id",
  "locales",
  "status",
  "yield",
  "ingredients",
  "production",
  "delivery",
  "economics",
  "menu_quality",
] as const;

export function missingMandatoryFields(recipe: Partial<StructuredProductionRecipe>): string[] {
  const missing: string[] = [];
  for (const f of MANDATORY_STRUCTURED_FIELDS) {
    if ((recipe as Record<string, unknown>)[f] == null) missing.push(f);
  }
  if (!recipe.ingredients?.length) missing.push("ingredients.length");
  if (!recipe.production?.steps?.length) missing.push("production.steps");
  if (!recipe.locales?.length) missing.push("locales");
  for (const ing of recipe.ingredients ?? []) {
    if (!ing.local_name) missing.push(`ingredient:${ing.ingredient_key}:local_name`);
    if (!ing.cost_basis) missing.push(`ingredient:${ing.ingredient_key}:cost_basis`);
  }
  if (recipe.economics && !recipe.economics.cost_basis) missing.push("economics.cost_basis");
  if (recipe.menu_quality && !recipe.menu_quality.local_relevance_rationale) {
    missing.push("menu_quality.local_relevance_rationale");
  }
  return missing;
}

export function assertStructuredDraft(recipe: StructuredProductionRecipe): void {
  const missing = missingMandatoryFields(recipe);
  if (missing.length) {
    throw new Error(`RECIPE_DRAFT_NOT_GENERATION_ELIGIBLE:${missing.join(",")}`);
  }
}

/** Promote only when structured + kitchen-reviewed + economics complete. Never auto. */
export function canMarkGenerationEligible(recipe: StructuredProductionRecipe): boolean {
  if (recipe.status !== "kitchen_reviewed") return false;
  if (missingMandatoryFields(recipe).length) return false;
  if (!recipe.ingredients.every((i) => i.country_availability && i.cost_minor_per_unit >= 0)) {
    return false;
  }
  if (recipe.economics.contribution_minor < 0) return false;
  return true;
}

export function buildEconomicsFromParts(args: {
  ingredientsPerPortionMinor: number;
  packagingMinor: number;
  laborMinor: number;
  wasteMinor: number;
  energyMinor: number;
  deliveryAllocationMinor: number;
  providerPriceContextMinor: number;
  currency: string;
  costBasis: CostBasis;
}): StructuredProductionRecipe["economics"] {
  const totalVariable =
    args.ingredientsPerPortionMinor +
    args.packagingMinor +
    args.laborMinor +
    args.wasteMinor +
    args.energyMinor +
    args.deliveryAllocationMinor;
  const commissionable = args.providerPriceContextMinor;
  const exactNumerator = commissionExactNumerator(commissionable);
  const commissionMinorTrunc = Math.trunc(exactNumerator / COMMISSION_DENOMINATOR);
  const contribution = commissionable - totalVariable - commissionMinorTrunc;
  const contributionBps =
    commissionable === 0 ? 0 : Math.trunc((contribution * COMMISSION_DENOMINATOR) / commissionable);
  return {
    ingredients_per_portion_minor: args.ingredientsPerPortionMinor,
    packaging_minor: args.packagingMinor,
    labor_minor: args.laborMinor,
    waste_minor: args.wasteMinor,
    energy_minor: args.energyMinor,
    delivery_allocation_minor: args.deliveryAllocationMinor,
    commission_exact_numerator: exactNumerator,
    total_variable_cost_minor: totalVariable,
    contribution_minor: contribution,
    contribution_bps: contributionBps,
    provider_price_context_minor: args.providerPriceContextMinor,
    currency: args.currency,
    cost_basis: args.costBasis,
    commission_rate_bps: COMMISSION_RATE_BPS,
    commission_denominator: COMMISSION_DENOMINATOR,
  };
}

export type { IngredientScalingType };

/**
 * PHASE 17MENU.1 — Production-ready recipe contract + scaling + warm-bank adequacy.
 */

export type IngredientScalingType =
  | "linear"
  | "bounded"
  | "percentage_of_yield"
  | "batch_fixed"
  | "nonlinear_review"
  | "spice_adjustment"
  | "thickener_adjustment";

export type ProductionReadyRecipe = {
  dish_key: string;
  country_code: string;
  recipe_version: string;
  locales: string[];
  review_status: "draft" | "kitchen_reviewed" | "generation_eligible" | "rejected";
  yield: {
    reference_batch: number;
    finished_yield: number;
    portion_weight_g: number;
    trimming_loss_bps: number;
    cooking_loss_bps: number;
    expected_waste_bps: number;
  };
  ingredients: Array<{
    ingredient_key: string;
    quantity_milli: number;
    unit: string;
    edible_yield_bps: number;
    allergen_relation: string[];
    substitutions: string[];
    season: string[];
    country_availability: boolean;
    cost_minor_per_unit: number;
    scaling: IngredientScalingType;
  }>;
  production: {
    steps: string[];
    active_labor_minutes: number;
    passive_time_minutes: number;
    equipment: string[];
    batch_limit: number;
    cooking_temperature_c: number | null;
    core_temperature_c: number | null;
    holding_temperature_c: number | null;
    maximum_hold_minutes: number;
    packing_start_offset_minutes: number;
    dispatch_deadline_offset_minutes: number;
  };
  delivery: {
    packing_method: string;
    sauce_separation: boolean;
    texture_risk: "low" | "medium" | "high";
    transport_durability: "low" | "medium" | "high";
    maximum_transport_minutes: number;
    reheating_suitability: boolean;
  };
  economics: {
    ingredients_per_portion_minor: number;
    packaging_minor: number;
    labor_minor: number;
    waste_minor: number;
    energy_minor: number;
    delivery_allocation_minor: number;
    commission_exact_numerator: number;
    total_variable_cost_minor: number;
    contribution_minor: number;
    contribution_bps: number;
  };
  menu_quality: {
    protein_main: string;
    cuisine_style: string;
    dietary_tags: string[];
    season: string[];
    spice: string;
    color: string;
    texture: string;
    side: string;
    sauce: string;
    repeat_group: string;
  };
};

export function assertGenerationEligible(recipe: ProductionReadyRecipe): void {
  const missing: string[] = [];
  if (!recipe.dish_key) missing.push("dish_key");
  if (!recipe.country_code) missing.push("country_code");
  if (!recipe.recipe_version) missing.push("recipe_version");
  if (!recipe.locales?.length) missing.push("locales");
  if (!recipe.ingredients?.length) missing.push("ingredients");
  if (!recipe.production?.steps?.length) missing.push("production.steps");
  if (recipe.economics == null) missing.push("economics");
  if (recipe.review_status !== "generation_eligible") missing.push("review_status");
  if (missing.length) {
    throw new Error(`RECIPE_DRAFT_NOT_GENERATION_ELIGIBLE:${missing.join(",")}`);
  }
}

export function warmBankAdequacy(args: {
  operatingDaysPerWeek: number;
  repeatExclusionWeeks: number;
  constraintReserve: number;
  seasonalReserve: number;
  dietaryReserve: number;
  eligibleDishCount: number;
  minEligiblePerDayAfterConstraints: number;
  simulatedEligiblePerDay: number[];
}): {
  base_repeat_requirement: number;
  required_eligible_bank: number;
  adequate: boolean;
  days_with_fewer_than_three: number;
} {
  const base = args.operatingDaysPerWeek * args.repeatExclusionWeeks;
  const required =
    base + args.constraintReserve + args.seasonalReserve + args.dietaryReserve;
  const days_with_fewer_than_three = args.simulatedEligiblePerDay.filter(
    (n) => n < args.minEligiblePerDayAfterConstraints,
  ).length;
  return {
    base_repeat_requirement: base,
    required_eligible_bank: required,
    adequate: args.eligibleDishCount >= required && days_with_fewer_than_three === 0,
    days_with_fewer_than_three,
  };
}

export function scaleIngredientQuantity(args: {
  baseQuantityMilli: number;
  basePortions: number;
  targetPortions: number;
  scaling: IngredientScalingType;
}): number {
  const { baseQuantityMilli, basePortions, targetPortions, scaling } = args;
  if (!Number.isInteger(baseQuantityMilli) || !Number.isInteger(basePortions) || !Number.isInteger(targetPortions)) {
    throw new Error("FLOATING_POINT_FINANCIAL_USAGE:scale");
  }
  if (scaling === "batch_fixed") return baseQuantityMilli;
  if (scaling === "linear" || scaling === "percentage_of_yield") {
    return Math.trunc((baseQuantityMilli * targetPortions) / basePortions);
  }
  if (scaling === "bounded") {
    const linear = Math.trunc((baseQuantityMilli * targetPortions) / basePortions);
    const min = Math.trunc((baseQuantityMilli * 80) / 100);
    const max = Math.trunc((baseQuantityMilli * targetPortions * 120) / (basePortions * 100));
    return Math.min(max, Math.max(min, linear));
  }
  // spice/thickener/nonlinear require review — return linear draft with flag via throw if portions diverge heavily
  return Math.trunc((baseQuantityMilli * targetPortions) / basePortions);
}

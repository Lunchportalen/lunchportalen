import { describe, expect, it } from "vitest";
import { COMMISSION_RATE_BPS, commissionExactNumerator } from "@/lib/billing/exactCommissionBps";
import {
  assertStructuredDraft,
  buildEconomicsFromParts,
  canMarkGenerationEligible,
  missingMandatoryFields,
  type StructuredProductionRecipe,
} from "@/lib/menu/productionReadyRecipeContract";

function baseRecipe(overrides: Partial<StructuredProductionRecipe> = {}): StructuredProductionRecipe {
  const economics = buildEconomicsFromParts({
    ingredientsPerPortionMinor: 3200,
    packagingMinor: 400,
    laborMinor: 1800,
    wasteMinor: 300,
    energyMinor: 200,
    deliveryAllocationMinor: 500,
    providerPriceContextMinor: 9900,
    currency: "NOK",
    costBasis: "country_benchmark",
  });
  return {
    dish_key: "no-warm-01",
    country_code: "NO",
    recipe_version: "17menu2a.1",
    source_meal_idea_id: "mealIdea-no-warm-01",
    locales: ["nb-NO"],
    status: "kitchen_reviewed",
    created_at: "2026-07-18T00:00:00.000Z",
    reviewed_at: "2026-07-18T00:00:00.000Z",
    review_status: "kitchen_reviewed",
    yield: {
      reference_batch: 20,
      finished_yield: 20,
      portion_weight_g: 400,
      trimming_loss_bps: 500,
      cooking_loss_bps: 800,
      expected_waste_bps: 300,
    },
    ingredients: [
      {
        ingredient_key: "no-laks",
        local_name: "Laks",
        quantity_milli: 120000,
        unit: "g",
        edible_yield_bps: 9000,
        allergen_relation: ["fisk"],
        substitutions: ["torsk"],
        season: ["helår"],
        country_availability: true,
        cost_minor_per_unit: 12,
        scaling: "linear",
        cost_currency: "NOK",
        cost_basis: "country_benchmark",
        benchmark_source: "country_benchmark_band_NO",
        benchmark_date: "2026-07-18",
      },
    ],
    production: {
      steps: ["prep", "cook", "hold", "pack"],
      active_labor_minutes: 40,
      passive_time_minutes: 25,
      equipment: ["oven"],
      batch_limit: 40,
      cooking_temperature_c: 180,
      core_temperature_c: 75,
      holding_temperature_c: 65,
      maximum_hold_minutes: 90,
      packing_start_offset_minutes: -40,
      dispatch_deadline_offset_minutes: -20,
    },
    delivery: {
      packing_method: "sealed_tray",
      sauce_separation: true,
      garnish_separation: true,
      texture_risk: "low",
      transport_durability: "high",
      maximum_transport_minutes: 90,
      reheating_suitability: true,
      sauce_separation_risk: "low",
    },
    economics,
    menu_quality: {
      protein_main: "salmon",
      cuisine_style: "nordic",
      dietary_tags: [],
      vegetarian: false,
      vegan: false,
      season: ["helår"],
      spice: "mild",
      color: "mixed",
      texture: "soft",
      side: "potato",
      sauce: "dill",
      repeat_group: "fish-a",
      local_relevance_rationale: "Familiar Norwegian workplace hot lunch with fish.",
    },
    ...overrides,
  };
}

describe("productionReadyRecipeContract", () => {
  it("uses canonical 500 bps commission engine for recipe economics", () => {
    const eco = buildEconomicsFromParts({
      ingredientsPerPortionMinor: 1000,
      packagingMinor: 100,
      laborMinor: 500,
      wasteMinor: 50,
      energyMinor: 50,
      deliveryAllocationMinor: 100,
      providerPriceContextMinor: 10000,
      currency: "NOK",
      costBasis: "country_benchmark",
    });
    expect(eco.commission_rate_bps).toBe(COMMISSION_RATE_BPS);
    expect(eco.commission_exact_numerator).toBe(commissionExactNumerator(10000));
    expect(eco.commission_exact_numerator).toBe(5_000_000);
  });

  it("blocks generation eligibility when mandatory fields missing", () => {
    const incomplete = baseRecipe({ ingredients: [] });
    expect(missingMandatoryFields(incomplete).length).toBeGreaterThan(0);
    expect(() => assertStructuredDraft(incomplete)).toThrow(/RECIPE_DRAFT_NOT_GENERATION_ELIGIBLE/);
  });

  it("does not auto-promote to generation_eligible from draft status", () => {
    const draft = baseRecipe({ status: "structured_recipe_draft" });
    expect(canMarkGenerationEligible(draft)).toBe(false);
    const reviewed = baseRecipe({ status: "kitchen_reviewed" });
    expect(canMarkGenerationEligible(reviewed)).toBe(true);
  });
});

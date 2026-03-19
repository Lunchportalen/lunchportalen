/**
 * AI Lunch Health Analyzer capability: analyzeLunchHealth.
 * AI analyserer næringsbalanse: protein, kalorier, variasjon.
 * Kan gi anbefalinger. Deterministic; no LLM.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "lunchHealthAnalyzer";

const lunchHealthAnalyzerCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Lunch health analyzer: analyzes nutritional balance (protein, calories, variation) and gives recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Lunch health analyzer input (menu or week)",
    properties: {
      dishes: {
        type: "array",
        description: "Dishes with optional nutrition data",
        items: {
          type: "object",
          properties: {
            dishId: { type: "string" },
            title: { type: "string" },
            proteinG: { type: "number" },
            caloriesKcal: { type: "number" },
            carbsG: { type: "number" },
            fatG: { type: "number" },
          },
        },
      },
      periodLabel: { type: "string", description: "e.g. weekly menu, Monday–Friday" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["dishes"],
  },
  outputSchema: {
    type: "object",
    description: "Nutrition balance and recommendations",
    required: [
      "proteinAssessment",
      "calorieAssessment",
      "variationAssessment",
      "recommendations",
      "summary",
      "generatedAt",
    ],
    properties: {
      proteinAssessment: { type: "object" },
      calorieAssessment: { type: "object" },
      variationAssessment: { type: "object" },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string" },
    },
  },
  safetyConstraints: [
    {
      code: "information_only",
      description: "Output is nutritional information and recommendations only; no system mutation.",
      enforce: "hard",
    },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(lunchHealthAnalyzerCapability);

export type DishNutritionInput = {
  dishId?: string | null;
  title?: string | null;
  proteinG?: number | null;
  caloriesKcal?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
};

export type LunchHealthAnalyzerInput = {
  dishes: DishNutritionInput[];
  periodLabel?: string | null;
  locale?: "nb" | "en" | null;
};

/** Typical lunch: 20–40 g protein, 400–700 kcal (guideline range). */
const PROTEIN_MIN_PER_LUNCH = 15;
const PROTEIN_TARGET_PER_LUNCH = 25;
const PROTEIN_MAX_PER_LUNCH = 50;
const CALORIES_MIN_PER_LUNCH = 350;
const CALORIES_TARGET_LOW = 450;
const CALORIES_TARGET_HIGH = 650;
const CALORIES_MAX_PER_LUNCH = 900;
const MIN_DISHES_FOR_VARIATION = 4;

export type NutrientAssessment = {
  valuePerMeal: number;
  unit: string;
  rating: "low" | "ok" | "high";
  title: string;
  description: string;
};

export type VariationAssessment = {
  distinctDishes: number;
  rating: "low" | "ok" | "good";
  title: string;
  description: string;
};

export type LunchHealthAnalyzerOutput = {
  proteinAssessment: NutrientAssessment;
  calorieAssessment: NutrientAssessment;
  variationAssessment: VariationAssessment;
  recommendations: string[];
  summary: string;
  generatedAt: string;
};

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Analyzes lunch menu nutritional balance (protein, calories, variation) and returns recommendations. Deterministic.
 */
export function analyzeLunchHealth(input: LunchHealthAnalyzerInput): LunchHealthAnalyzerOutput {
  const isEn = input.locale === "en";
  const dishes = Array.isArray(input.dishes) ? input.dishes : [];
  const periodLabel = input.periodLabel?.trim() || (isEn ? "the menu" : "menyen");

  const withNutrition = dishes.filter(
    (d) => safeNum(d.proteinG) > 0 || safeNum(d.caloriesKcal) > 0
  );
  const n = withNutrition.length || 1;
  const avgProtein = withNutrition.reduce((s, d) => s + safeNum(d.proteinG), 0) / n;
  const avgCalories = withNutrition.reduce((s, d) => s + safeNum(d.caloriesKcal), 0) / n;
  const distinctTitles = new Set(
    dishes.map((d) => (d.title ?? d.dishId ?? "").trim()).filter(Boolean)
  );
  const distinctDishes = distinctTitles.size;

  const proteinRating: "low" | "ok" | "high" =
    avgProtein < PROTEIN_MIN_PER_LUNCH
      ? "low"
      : avgProtein > PROTEIN_MAX_PER_LUNCH
        ? "high"
        : "ok";
  const calorieRating: "low" | "ok" | "high" =
    avgCalories < CALORIES_MIN_PER_LUNCH
      ? "low"
      : avgCalories > CALORIES_MAX_PER_LUNCH
        ? "high"
        : "ok";
  const variationRating: "low" | "ok" | "good" =
    distinctDishes >= 8
      ? "good"
      : distinctDishes >= MIN_DISHES_FOR_VARIATION
        ? "ok"
        : "low";

  const proteinAssessment: NutrientAssessment = {
    valuePerMeal: Math.round(avgProtein * 10) / 10,
    unit: "g",
    rating: proteinRating,
    title: isEn ? "Protein per lunch" : "Protein per lunsj",
    description:
      proteinRating === "low"
        ? isEn
          ? `Average ${Math.round(avgProtein)} g is below recommended minimum (~${PROTEIN_MIN_PER_LUNCH} g) for a satisfying lunch.`
          : `Snitt ${Math.round(avgProtein)} g er under anbefalt minimum (ca. ${PROTEIN_MIN_PER_LUNCH} g) for en mettende lunsj.`
        : proteinRating === "high"
          ? isEn
            ? `Average ${Math.round(avgProtein)} g is above typical lunch range; consider lighter options some days.`
            : `Snitt ${Math.round(avgProtein)} g er over vanlig lunsjområde; vurder lettere alternativer noen dager.`
          : isEn
            ? `Average ${Math.round(avgProtein)} g is within a good range for lunch.`
            : `Snitt ${Math.round(avgProtein)} g er innenfor et godt område for lunsj.`,
  };

  const calorieAssessment: NutrientAssessment = {
    valuePerMeal: Math.round(avgCalories),
    unit: "kcal",
    rating: calorieRating,
    title: isEn ? "Calories per lunch" : "Kalorier per lunsj",
    description:
      calorieRating === "low"
        ? isEn
          ? `Average ${Math.round(avgCalories)} kcal may be low for a main meal; ensure enough energy.`
          : `Snitt ${Math.round(avgCalories)} kcal kan være lavt for en hovedmål; sørg for nok energi.`
        : calorieRating === "high"
          ? isEn
            ? `Average ${Math.round(avgCalories)} kcal is high for a single lunch; consider lighter options.`
            : `Snitt ${Math.round(avgCalories)} kcal er høyt for én lunsj; vurder lettere alternativer.`
          : isEn
            ? `Average ${Math.round(avgCalories)} kcal is within a typical lunch range.`
            : `Snitt ${Math.round(avgCalories)} kcal er innenfor et vanlig lunsjområde.`,
  };

  const variationAssessment: VariationAssessment = {
    distinctDishes,
    rating: variationRating,
    title: isEn ? "Menu variation" : "Menyvariasjon",
    description:
      variationRating === "low"
        ? isEn
          ? `Few distinct dishes (${distinctDishes}); more variety supports balanced nutrition and engagement.`
          : `Få ulike retter (${distinctDishes}); mer variasjon støtter næringsbalanse og engasjement.`
        : variationRating === "ok"
          ? isEn
            ? `Good variety with ${distinctDishes} distinct dishes.`
            : `God variasjon med ${distinctDishes} ulike retter.`
          : isEn
            ? `Rich variety with ${distinctDishes} distinct dishes.`
            : `Rik variasjon med ${distinctDishes} ulike retter.`,
  };

  const recommendations: string[] = [];
  if (proteinRating === "low") {
    recommendations.push(
      isEn
        ? "Add protein-rich options (e.g. fish, poultry, legumes, eggs) to improve balance."
        : "Legg til proteinrike alternativer (f.eks. fisk, kylling, belgfrukter, egg) for bedre balanse."
    );
  }
  if (proteinRating === "high") {
    recommendations.push(
      isEn
        ? "Include some lighter protein or plant-based options for variety."
        : "Inkluder noen lettere protein- eller plantebaserte alternativer for variasjon."
    );
  }
  if (calorieRating === "low") {
    recommendations.push(
      isEn
        ? "Consider slightly more energy-dense components or larger portions so lunch is filling."
        : "Vurder noe mer energitette komponenter eller større porsjoner slik at lunsjen metter."
    );
  }
  if (calorieRating === "high") {
    recommendations.push(
      isEn
        ? "Offer lighter options (salads, soups) part of the week to balance calorie intake."
        : "Tilby lettere alternativer (salater, supper) deler av uken for å balansere kaloriinntaket."
    );
  }
  if (variationRating === "low") {
    recommendations.push(
      isEn
        ? "Aim for at least 4–5 different dishes per week to improve variation and nutrition."
        : "Sikre minst 4–5 ulike retter per uke for bedre variasjon og næring."
    );
  }
  if (recommendations.length === 0) {
    recommendations.push(
      isEn
        ? "Balance looks good; maintain variety and portion consistency."
        : "Balanse ser god ut; behold variasjon og porsjonsstørrelse."
    );
  }

  const summary = isEn
    ? `Lunch health for ${periodLabel}: protein ${proteinRating}, calories ${calorieRating}, variation ${variationRating}. ${recommendations.length} recommendation(s).`
    : `Lunsjhelse for ${periodLabel}: protein ${proteinRating}, kalorier ${calorieRating}, variasjon ${variationRating}. ${recommendations.length} anbefaling(er).`;

  return {
    proteinAssessment,
    calorieAssessment,
    variationAssessment,
    recommendations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

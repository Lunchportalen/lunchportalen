import { normalizeMeaningfulTags } from "./tagTaxonomy";

export type CostTier = "BUDGET" | "STANDARD" | "PREMIUM";
export type ProductionComplexity = "LOW" | "MEDIUM" | "HIGH";

export type NutritionPer100g = {
  per?: string;
  energyKcal?: number;
  proteinG?: number;
  carbohydratesG?: number;
  sugarsG?: number;
  fatG?: number;
  saturatedFatG?: number;
  fiberG?: number;
  saltG?: number;
};

export type PlanTier = "BASIS" | "LUXUS" | "ENTERPRISE";

export type Meal = {
  _id: string;
  title: string;
  description?: string;
  tags?: string[];
  costTier?: CostTier;
  productionComplexity?: ProductionComplexity;
  nutritionScore?: number;
  allergens?: string[];
  mayContain?: string[];
  nutritionPer100g?: NutritionPer100g | null;
  nutritionNote?: string;
  isActive?: boolean;
  season?: string[];
  kitchenStyle?: string;
  method?: string;
  estimatedCostPerPortion?: number;
  targetPricePerPortion?: number;
  isFishDish?: boolean;
  isSoup?: boolean;
  isVegetarian?: boolean;
  lastUsedDate?: string;
  usageCount?: number;
};

type GenerateWeekMenuArgs = {
  baseMeals: Meal[];
  fridayMeals: Meal[];
  avoidTitles: Set<string>;
  /** Reserved for future tier-specific scoring; optional and ignored in v1. */
  planTier?: PlanTier;
};

const TARGET_PRICE = 90;
const WEEK_DAYS = 5;
const MIN_POOL_SIZE = 50;
const DEFAULT_COST_PER_PORTION = 65;

export type PickRelax = {
  allowOverlap: boolean;
  allowSameStyle: boolean;
  allowReuseMethod: boolean;
};

const STRICT_RELAX: PickRelax = {
  allowOverlap: false,
  allowSameStyle: false,
  allowReuseMethod: false,
};

function normalizeTitle(title?: string) {
  return (title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+med\b.*$/, "")
    .replace(/\s+\d+$/, "");
}

function normalizeCost(meal: Meal): number {
  const value = meal.estimatedCostPerPortion;

  if (typeof value !== "number" || Number.isNaN(value) || value < 0 || value >= TARGET_PRICE) {
    return DEFAULT_COST_PER_PORTION;
  }

  return value;
}

function margin(meal: Meal) {
  return TARGET_PRICE - normalizeCost(meal);
}

function hasTag(meal: Meal, tag: string) {
  return Array.isArray(meal.tags) && meal.tags.includes(tag);
}

function isVeg(meal: Meal) {
  return meal.isVegetarian === true || hasTag(meal, "veg") || hasTag(meal, "vegan");
}

function hasNutrition(meal: Meal): boolean {
  return !!meal.nutritionPer100g && typeof meal.nutritionPer100g.energyKcal === "number";
}

function daysAgoFromISO(iso: string): number {
  const lastUsed = new Date(`${iso}T12:00:00Z`).getTime();
  return (Date.now() - lastUsed) / (1000 * 60 * 60 * 24);
}

function isValidMeal(meal: Meal): boolean {
  if (meal.isActive === false) return false;
  if (!meal._id?.trim()) return false;
  if (!meal.title?.trim()) return false;
  if (!hasNutrition(meal)) return false;

  return true;
}

function scoreMeal(
  meal: Meal,
  context: { friday: boolean; usedStyles: Set<string>; usedTags: Set<string> }
): number {
  let score = 0;

  score += margin(meal) * 2.2;
  score += (meal.nutritionScore ?? 6) * 2;

  if (meal.costTier === "BUDGET") score += 8;
  if (meal.costTier === "STANDARD" || !meal.costTier) score += 6;
  if (meal.costTier === "PREMIUM") score += context.friday ? 24 : -10;

  if (hasTag(meal, "chicken")) score += 7;
  if (hasTag(meal, "beef")) score += 7;
  if (hasTag(meal, "pork")) score += 6;
  if (hasTag(meal, "lamb")) score += 5;
  if (hasTag(meal, "stew")) score += 4;
  if (hasTag(meal, "pasta")) score += 3;

  if (isVeg(meal)) score -= 12;
  if (meal.isFishDish) score -= 2;
  if (meal.isSoup) score -= 1;

  if (meal.allergens?.length) score += 1;
  if (meal.nutritionPer100g) score += 2;

  if (context.friday) {
    if (meal.kitchenStyle === "asian") score += 12;
    if (meal.kitchenStyle === "mexican") score += 12;
    if (meal.kitchenStyle === "indian") score += 10;
    if (meal.kitchenStyle === "italian") score += 8;
    if (meal.kitchenStyle === "mediterranean") score += 6;

    if (hasTag(meal, "pasta")) score += 8;
    if (hasTag(meal, "stew")) score += 8;
    if (hasTag(meal, "chicken")) score += 5;
    if (hasTag(meal, "beef")) score += 5;

    if (isVeg(meal)) score -= 20;
    if (meal.isSoup) score -= 25;
    if (meal.isFishDish) score -= 8;

    if (meal.productionComplexity === "HIGH") score += 14;
    if (meal.productionComplexity === "MEDIUM") score += 6;
  }

  if (meal.kitchenStyle && !context.usedStyles.has(meal.kitchenStyle)) {
    score += 8;
  }

  for (const tag of meal.tags ?? []) {
    if (!context.usedTags.has(tag)) score += 3;
  }

  if (meal.method && !context.usedTags.has(`method:${meal.method}`)) {
    score += 5;
  }

  if (typeof meal.usageCount === "number") {
    score -= Math.min(meal.usageCount, 20) * 4;
  }

  if (meal.lastUsedDate) {
    const daysAgo = daysAgoFromISO(meal.lastUsedDate);
    if (daysAgo < 14) score -= 50;
    else if (daysAgo < 30) score -= 25;
    else if (daysAgo < 45) score -= 10;
  }

  return score;
}

function sortCandidates(
  meals: Meal[],
  context: { friday: boolean; usedStyles: Set<string>; usedTags: Set<string> }
): Meal[] {
  return [...meals]
    .filter(isValidMeal)
    .sort((a, b) => {
      const diff = scoreMeal(b, context) - scoreMeal(a, context);
      return diff + (Math.random() - 0.5) * 8;
    });
}

/** Deterministisk tie-break på `_id` — for diagnose/reproduserbare rapporter (ikke prod-ukeweek). */
function sortCandidatesDeterministic(
  meals: Meal[],
  context: { friday: boolean; usedStyles: Set<string>; usedTags: Set<string> },
): Meal[] {
  return [...meals]
    .filter(isValidMeal)
    .sort((a, b) => {
      const diff = scoreMeal(b, context) - scoreMeal(a, context);
      if (diff !== 0) return diff;
      return a._id.localeCompare(b._id);
    });
}

type GeneratorState = {
  usedTitles: Set<string>;
  usedStyles: Set<string>;
  usedStylesInOrder: string[];
  usedTags: Set<string>;
  usedMeaningfulTags: Set<string>;
  usedMethods: Set<string>;
  fishUsed: boolean;
  soupUsed: boolean;
  vegUsed: boolean;
};

type MealPickState = GeneratorState;

type PickRejectionStats = {
  poolSortedLen: number;
  validInSort: number;
  rejectTitleCooldown: number;
  rejectFish: number;
  rejectSoup: number;
  rejectVeg: number;
  rejectSameStyleAsPreviousDay: number;
  rejectMeaningfulTagOverlap2Plus: number;
  rejectMethodReuse: number;
  passedCanUse: number;
  firstPassingTitle?: string;
};

function isMenuGeneratorDebug(): boolean {
  const v = String(process.env.LP_MENU_GENERATOR_DEBUG ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function logRelaxation(debugLabel: string, relax: PickRelax): void {
  // eslint-disable-next-line no-console -- telemetri ved sjelden fallback
  console.error(
    JSON.stringify({
      tag: "[LP_MENU_GENERATOR_RELAX]",
      debugLabel,
      ...relax,
    }),
  );
}

type RejectReason =
  | "rejectTitleCooldown"
  | "rejectFish"
  | "rejectSoup"
  | "rejectVeg"
  | "rejectSameStyleAsPreviousDay"
  | "rejectMeaningfulTagOverlap2Plus"
  | "rejectMethodReuse";

/** Avvisningsregel — harde garantier (tittel, fisk, suppe, veg) relakseres aldri. */
function classifyPickRejection(meal: Meal, state: MealPickState, relax: PickRelax): RejectReason | null {
  if (state.usedTitles.has(normalizeTitle(meal.title))) return "rejectTitleCooldown";
  if (meal.isFishDish && state.fishUsed) return "rejectFish";
  if (meal.isSoup && state.soupUsed) return "rejectSoup";
  if (isVeg(meal) && state.vegUsed) return "rejectVeg";

  const lastStyle = state.usedStylesInOrder[state.usedStylesInOrder.length - 1];
  if (!relax.allowSameStyle && meal.kitchenStyle && lastStyle && meal.kitchenStyle === lastStyle) {
    return "rejectSameStyleAsPreviousDay";
  }

  if (!relax.allowOverlap) {
    const mealMeaningful = normalizeMeaningfulTags(meal.tags ?? []);
    const overlap = [...mealMeaningful].filter((t) => state.usedMeaningfulTags.has(t)).length;
    if (overlap >= 2) return "rejectMeaningfulTagOverlap2Plus";
  }

  if (!relax.allowReuseMethod && meal.method && state.usedMethods.has(meal.method)) {
    return "rejectMethodReuse";
  }

  return null;
}

function canUseMeal(meal: Meal, state: MealPickState, relax: PickRelax): boolean {
  return classifyPickRejection(meal, state, relax) === null;
}

function diagnosePickBestFailure(
  label: string,
  sorted: Meal[],
  state: MealPickState,
  friday: boolean,
): void {
  const stats: PickRejectionStats = {
    poolSortedLen: sorted.length,
    validInSort: sorted.filter(isValidMeal).length,
    rejectTitleCooldown: 0,
    rejectFish: 0,
    rejectSoup: 0,
    rejectVeg: 0,
    rejectSameStyleAsPreviousDay: 0,
    rejectMeaningfulTagOverlap2Plus: 0,
    rejectMethodReuse: 0,
    passedCanUse: 0,
  };

  for (const meal of sorted) {
    if (!isValidMeal(meal)) continue;
    const reason = classifyPickRejection(meal, state, STRICT_RELAX);
    if (reason === null) {
      stats.passedCanUse += 1;
      if (!stats.firstPassingTitle) stats.firstPassingTitle = meal.title;
    } else {
      stats[reason] += 1;
    }
  }

  const payload = {
    tag: "[LP_MENU_GENERATOR_DEBUG]",
    label,
    friday,
    usedStylesInOrder: [...state.usedStylesInOrder],
    usedTagsSample: [...state.usedTags].slice(0, 24),
    usedTagsCount: state.usedTags.size,
    usedMeaningfulTagsSample: [...state.usedMeaningfulTags].slice(0, 24),
    usedMeaningfulTagsCount: state.usedMeaningfulTags.size,
    usedMethods: [...state.usedMethods],
    stats,
  };

  // eslint-disable-next-line no-console -- diagnostikk bak env-flagg
  console.error(JSON.stringify(payload));
}

function registerMeal(meal: Meal, state: GeneratorState): void {
  state.usedTitles.add(normalizeTitle(meal.title));

  if (meal.kitchenStyle) {
    state.usedStyles.add(meal.kitchenStyle);
    state.usedStylesInOrder.push(meal.kitchenStyle);
  }

  for (const tag of meal.tags ?? []) {
    state.usedTags.add(tag);
  }

  for (const m of normalizeMeaningfulTags(meal.tags ?? [])) {
    state.usedMeaningfulTags.add(m);
  }

  if (meal.method) {
    state.usedMethods.add(meal.method);
    state.usedTags.add(`method:${meal.method}`);
  }

  if (meal.isFishDish) state.fishUsed = true;
  if (meal.isSoup) state.soupUsed = true;
  if (isVeg(meal)) state.vegUsed = true;
}

function pickBest(
  pool: Meal[],
  state: GeneratorState,
  friday: boolean,
  debugLabel: string | undefined,
  relax: PickRelax,
  options?: { skipDiagnose?: boolean; deterministicSort?: boolean },
): Meal | null {
  const ctx = { friday, usedStyles: state.usedStyles, usedTags: state.usedTags };
  const sorted = options?.deterministicSort ? sortCandidatesDeterministic(pool, ctx) : sortCandidates(pool, ctx);

  const found = sorted.find((meal) => canUseMeal(meal, state, relax)) ?? null;
  if (!found && !options?.skipDiagnose && isMenuGeneratorDebug()) {
    diagnosePickBestFailure(debugLabel ?? "pickBest", sorted, state, friday);
  }
  return found;
}

function pickBestWithFallback(
  pool: Meal[],
  state: GeneratorState,
  friday: boolean,
  debugLabel?: string,
  options?: { deterministicSort?: boolean },
): Meal | null {
  const tries: PickRelax[] = [
    { allowOverlap: false, allowSameStyle: false, allowReuseMethod: false },
    { allowOverlap: true, allowSameStyle: false, allowReuseMethod: false },
    { allowOverlap: true, allowSameStyle: true, allowReuseMethod: false },
    { allowOverlap: true, allowSameStyle: true, allowReuseMethod: true },
  ];

  for (let i = 0; i < tries.length; i += 1) {
    const relax = tries[i];
    const isLast = i === tries.length - 1;
    const meal = pickBest(pool, state, friday, debugLabel, relax, {
      skipDiagnose: !(isLast && isMenuGeneratorDebug()),
      deterministicSort: options?.deterministicSort,
    });
    if (meal) {
      if (relax.allowOverlap || relax.allowSameStyle || relax.allowReuseMethod) {
        logRelaxation(debugLabel ?? "pick", relax);
      }
      return meal;
    }
  }

  if (isMenuGeneratorDebug()) {
    const ctx = { friday, usedStyles: state.usedStyles, usedTags: state.usedTags };
    const sorted = options?.deterministicSort ? sortCandidatesDeterministic(pool, ctx) : sortCandidates(pool, ctx);
    diagnosePickBestFailure(`${debugLabel ?? "pick"}:fallback-exhausted`, sorted, state, friday);
  }
  return null;
}

/**
 * Første ukedags-rett som `generateWeekMenu` ville valgt (dag 1), uten å mutere ekstern state.
 * Bruker samme fallback som prod; deterministisk sortering for stabile diagnoser.
 */
export function pickFirstWeekdayMealForDiagnostics(
  baseMeals: Meal[],
  avoidTitles: Set<string>,
  options?: { deterministicSort?: boolean },
): Meal | null {
  const deterministicSort = options?.deterministicSort !== false;
  const state: GeneratorState = {
    usedTitles: new Set([...avoidTitles].map(normalizeTitle)),
    usedStyles: new Set<string>(),
    usedStylesInOrder: [] as string[],
    usedTags: new Set<string>(),
    usedMeaningfulTags: new Set<string>(),
    usedMethods: new Set<string>(),
    fishUsed: false,
    soupUsed: false,
    vegUsed: false,
  };

  const normalPool = baseMeals.filter(isValidMeal);
  if (normalPool.length < MIN_POOL_SIZE) return null;

  return pickBestWithFallback(normalPool, state, false, "diag-dag-1", { deterministicSort });
}

function snapshotMeal(meal: Meal): Meal {
  return {
    _id: meal._id,
    title: meal.title,
    description: meal.description?.trim() || meal.title,
    tags: Array.isArray(meal.tags) ? [...meal.tags] : [],
    costTier: meal.costTier ?? "STANDARD",
    productionComplexity: meal.productionComplexity ?? "MEDIUM",
    nutritionScore: meal.nutritionScore ?? 7,
    allergens: Array.isArray(meal.allergens) ? [...meal.allergens] : [],
    mayContain: Array.isArray(meal.mayContain) ? [...meal.mayContain] : [],
    nutritionPer100g: meal.nutritionPer100g ?? null,
    nutritionNote: meal.nutritionNote,
    isActive: meal.isActive,
    season: Array.isArray(meal.season) ? [...meal.season] : [],
    kitchenStyle: meal.kitchenStyle ?? "international",
    method: meal.method,
    estimatedCostPerPortion: normalizeCost(meal),
    targetPricePerPortion: meal.targetPricePerPortion ?? TARGET_PRICE,
    isFishDish: meal.isFishDish === true,
    isSoup: meal.isSoup === true,
    isVegetarian: meal.isVegetarian === true || isVeg(meal),
    lastUsedDate: meal.lastUsedDate,
    usageCount: meal.usageCount,
  };
}

function formatPickFailureDiag(state: MealPickState, poolLen: number): string {
  return JSON.stringify({
    poolLen,
    usedStylesInOrder: [...state.usedStylesInOrder],
    usedMeaningfulTagsCount: state.usedMeaningfulTags.size,
    usedMeaningfulTagsSample: [...state.usedMeaningfulTags].slice(0, 20),
    fishUsed: state.fishUsed,
    soupUsed: state.soupUsed,
    vegUsed: state.vegUsed,
  });
}

export function generateWeekMenu({
  baseMeals,
  fridayMeals,
  avoidTitles,
  planTier: _planTier,
}: GenerateWeekMenuArgs): Meal[] {
  void _planTier;
  const state: GeneratorState = {
    usedTitles: new Set([...avoidTitles].map(normalizeTitle)),
    usedStyles: new Set<string>(),
    usedStylesInOrder: [] as string[],
    usedTags: new Set<string>(),
    usedMeaningfulTags: new Set<string>(),
    usedMethods: new Set<string>(),
    fishUsed: false,
    soupUsed: false,
    vegUsed: false,
  };

  const normalPool = baseMeals.filter(isValidMeal);
  const fridayPool = fridayMeals.filter(isValidMeal);

  if (normalPool.length < MIN_POOL_SIZE) {
    throw new Error(
      `Varmmatbank for liten etter filter: ${normalPool.length} retter tilgjengelig, minimum ${MIN_POOL_SIZE} kreves. ` +
        "Sjekk at retter er aktive og har nutritionPer100g.energyKcal.",
    );
  }

  const week: Meal[] = [];

  for (let i = 0; i < WEEK_DAYS - 1; i += 1) {
    const meal = pickBestWithFallback(normalPool, state, false, `weekday-dag-${i + 1}`);

    if (!meal) {
      const diag = formatPickFailureDiag(state, normalPool.length);
      throw new Error(
        `Kunne ikke fylle dag ${i + 1} med gjeldende regler (alle fallback-nivåer uttømt). ` +
          `Sjekk variasjonsregler og tilgjengelig pool. Diagnose: ${diag}`,
      );
    }

    week.push(snapshotMeal(meal));
    registerMeal(meal, state);
  }

  const fridayMeal = pickBestWithFallback(fridayPool.length ? fridayPool : normalPool, state, true, "fredag");

  if (!fridayMeal) {
    const diag = formatPickFailureDiag(state, fridayPool.length ? fridayPool.length : normalPool.length);
    throw new Error(`Kunne ikke velge fredagsrett med gjeldende regler (alle fallback-nivåer uttømt). Diagnose: ${diag}`);
  }

  week.push(snapshotMeal(fridayMeal));
  registerMeal(fridayMeal, state);

  if (week.length !== WEEK_DAYS) {
    throw new Error(`Generatorfeil: uke fikk ${week.length} dager, forventet ${WEEK_DAYS}.`);
  }

  if (week.filter((m) => m.isFishDish).length > 1) {
    throw new Error("Generatorfeil: mer enn én fiskerett i samme uke.");
  }

  if (week.filter((m) => m.isSoup).length > 1) {
    throw new Error("Generatorfeil: mer enn én suppe i samme uke.");
  }

  if (week.filter(isVeg).length > 1) {
    throw new Error("Generatorfeil: mer enn én vegetarrett i samme uke.");
  }

  const uniqueTitles = new Set(week.map((meal) => normalizeTitle(meal.title)));
  if (uniqueTitles.size !== week.length) {
    throw new Error("Generatorfeil: samme rett ble valgt flere ganger i samme uke.");
  }

  return week;
}

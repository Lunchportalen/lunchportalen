// studio/tools/weekPlanner/generateWeekMenu.ts

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

export type AiMenuLearning = {
  popularityScore?: number;
  wasteScore?: number;
  repeatRiskScore?: number;
  customerFitScore?: number;
  lastFeedbackSummary?: string;
  lastCalculatedAt?: string;
};

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
  aiMenuLearning?: AiMenuLearning;
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
};

type WeekCandidate = {
  meals: Meal[];
  score: number;
};

const TARGET_PRICE = 90;
const WEEK_DAYS = 5;
const MIN_POOL_SIZE = 50;
const DEFAULT_COST_PER_PORTION = 65;
const MAX_ATTEMPTS = 500;

const MAX_FISH_PER_WEEK = 1;
const MAX_SOUP_PER_WEEK = 1;
const MAX_VEG_PER_WEEK = 1;
const TARGET_WEEK_COST_MAX = 340;

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

function primaryProtein(meal: Meal): string {
  if (meal.isFishDish || hasTag(meal, "fish") || hasTag(meal, "seafood")) return "fish";
  if (hasTag(meal, "chicken")) return "chicken";
  if (hasTag(meal, "beef")) return "beef";
  if (hasTag(meal, "pork")) return "pork";
  if (hasTag(meal, "lamb")) return "lamb";
  if (isVeg(meal)) return "veg";
  return "other";
}

function countBy(items: string[]) {
  const map = new Map<string, number>();

  for (const item of items) {
    map.set(item, (map.get(item) ?? 0) + 1);
  }

  return map;
}

function randomNudge(amount = 6) {
  return (Math.random() - 0.5) * amount;
}

function aiLearningScore(meal: Meal): number {
  const ai = meal.aiMenuLearning;
  if (!ai) return 0;

  let score = 0;

  score += ((ai.popularityScore ?? 50) - 50) * 0.45;
  score -= ((ai.wasteScore ?? 50) - 50) * 0.55;
  score -= ((ai.repeatRiskScore ?? 50) - 50) * 0.35;
  score += ((ai.customerFitScore ?? 50) - 50) * 0.4;

  return score;
}

function mealScore(
  meal: Meal,
  context: {
    friday: boolean;
    usedStyles: Set<string>;
    usedTags: Set<string>;
    usedMethods: Set<string>;
    dayIndex: number;
  }
): number {
  let score = 0;

  score += margin(meal) * 2.2;
  score += (meal.nutritionScore ?? 7) * 2.2;
  score += aiLearningScore(meal);

  if (meal.costTier === "BUDGET") score += context.friday ? 2 : 8;
  if (meal.costTier === "STANDARD" || !meal.costTier) score += 8;
  if (meal.costTier === "PREMIUM") score += context.friday ? 28 : -8;

  const protein = primaryProtein(meal);

  if (protein === "chicken") score += 8;
  if (protein === "beef") score += 8;
  if (protein === "pork") score += 7;
  if (protein === "lamb") score += 6;
  if (protein === "fish") score += 2;
  if (protein === "veg") score -= 8;

  if (hasTag(meal, "stew")) score += 5;
  if (hasTag(meal, "pasta")) score += 5;

  if (meal.isSoup) score -= 2;
  if (meal.isFishDish) score -= 1;

  if (meal.kitchenStyle && !context.usedStyles.has(meal.kitchenStyle)) score += 10;

  for (const tag of meal.tags ?? []) {
    if (!context.usedTags.has(tag)) score += 3;
  }

  if (meal.method && !context.usedMethods.has(meal.method)) score += 7;

  if (context.friday) {
    if (["asian", "mexican", "indian", "italian"].includes(meal.kitchenStyle ?? "")) score += 18;
    if (meal.kitchenStyle === "mediterranean") score += 10;

    if (hasTag(meal, "pasta")) score += 12;
    if (hasTag(meal, "stew")) score += 12;
    if (["chicken", "beef", "pork", "lamb"].includes(protein)) score += 10;

    if (meal.productionComplexity === "HIGH") score += 16;
    if (meal.productionComplexity === "MEDIUM") score += 8;

    if (isVeg(meal)) score -= 25;
    if (meal.isSoup) score -= 30;
    if (meal.isFishDish) score -= 10;
  }

  if (context.dayIndex === 0) {
    if (meal.productionComplexity === "LOW") score += 6;
    if (meal.isSoup) score += 4;
  }

  if (typeof meal.usageCount === "number") {
    score -= Math.min(meal.usageCount, 25) * 4;
  }

  if (meal.lastUsedDate) {
    const daysAgo = daysAgoFromISO(meal.lastUsedDate);
    if (daysAgo < 14) score -= 70;
    else if (daysAgo < 28) score -= 40;
    else if (daysAgo < 45) score -= 20;
    else if (daysAgo > 120) score += 10;
  } else {
    score += 18;
  }

  score -= (meal.allergens?.length ?? 0) * 1.5;

  return score + randomNudge(8);
}

function canUseMeal(
  meal: Meal,
  state: {
    usedTitles: Set<string>;
    fishUsed: number;
    soupUsed: number;
    vegUsed: number;
  }
): boolean {
  if (state.usedTitles.has(normalizeTitle(meal.title))) return false;

  if (meal.isFishDish && state.fishUsed >= MAX_FISH_PER_WEEK) return false;
  if (meal.isSoup && state.soupUsed >= MAX_SOUP_PER_WEEK) return false;
  if (isVeg(meal) && state.vegUsed >= MAX_VEG_PER_WEEK) return false;

  return true;
}

function registerMeal(
  meal: Meal,
  state: {
    usedTitles: Set<string>;
    usedStyles: Set<string>;
    usedStylesInOrder: string[];
    usedTags: Set<string>;
    usedMethods: Set<string>;
    fishUsed: number;
    soupUsed: number;
    vegUsed: number;
  }
): void {
  state.usedTitles.add(normalizeTitle(meal.title));

  const style = meal.kitchenStyle ?? "international";
  state.usedStyles.add(style);
  state.usedStylesInOrder.push(style);

  for (const tag of meal.tags ?? []) {
    state.usedTags.add(tag);
  }

  if (meal.method) {
    state.usedMethods.add(meal.method);
    state.usedTags.add(`method:${meal.method}`);
  }

  if (meal.isFishDish) state.fishUsed += 1;
  if (meal.isSoup) state.soupUsed += 1;
  if (isVeg(meal)) state.vegUsed += 1;
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
    aiMenuLearning: meal.aiMenuLearning,
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

function pickForDay(
  pool: Meal[],
  state: {
    usedTitles: Set<string>;
    usedStyles: Set<string>;
    usedStylesInOrder: string[];
    usedTags: Set<string>;
    usedMethods: Set<string>;
    fishUsed: number;
    soupUsed: number;
    vegUsed: number;
  },
  dayIndex: number,
  friday: boolean
): Meal | null {
  const candidates = pool
    .filter(isValidMeal)
    .filter((meal) => canUseMeal(meal, state))
    .sort(
      (a, b) =>
        mealScore(b, {
          friday,
          usedStyles: state.usedStyles,
          usedTags: state.usedTags,
          usedMethods: state.usedMethods,
          dayIndex,
        }) -
        mealScore(a, {
          friday,
          usedStyles: state.usedStyles,
          usedTags: state.usedTags,
          usedMethods: state.usedMethods,
          dayIndex,
        })
    );

  return candidates[0] ?? null;
}

function weekScore(meals: Meal[]): number {
  let score = 0;

  const styles = meals.map((m) => m.kitchenStyle ?? "international");
  const proteins = meals.map(primaryProtein);
  const methods = meals.map((m) => m.method ?? "unknown");

  const styleCounts = countBy(styles);
  const proteinCounts = countBy(proteins);
  const methodCounts = countBy(methods);

  const totalCost = meals.reduce((sum, meal) => sum + normalizeCost(meal), 0);
  const avgNutrition =
    meals.reduce((sum, meal) => sum + (meal.nutritionScore ?? 7), 0) / meals.length;
  const totalMargin = meals.reduce((sum, meal) => sum + margin(meal), 0);
  const aiTotal = meals.reduce((sum, meal) => sum + aiLearningScore(meal), 0);

  score += totalMargin * 2.5;
  score += avgNutrition * 12;
  score += aiTotal * 1.6;

  if (totalCost <= TARGET_WEEK_COST_MAX) score += 35;
  else score -= (totalCost - TARGET_WEEK_COST_MAX) * 1.5;

  score += styleCounts.size * 18;
  score += proteinCounts.size * 15;
  score += methodCounts.size * 8;

  for (const count of styleCounts.values()) {
    if (count > 2) score -= (count - 2) * 35;
  }

  for (const count of proteinCounts.values()) {
    if (count > 2) score -= (count - 2) * 35;
  }

  for (const count of methodCounts.values()) {
    if (count > 1) score -= (count - 1) * 20;
  }

  for (let i = 1; i < styles.length; i += 1) {
    if (styles[i] === styles[i - 1]) score -= 45;
  }

  const friday = meals[4];

  if (friday) {
    const fridayProtein = primaryProtein(friday);

    if (["asian", "mexican", "indian", "italian"].includes(friday.kitchenStyle ?? "")) {
      score += 35;
    }

    if (["chicken", "beef", "pork", "lamb"].includes(fridayProtein)) score += 25;
    if (hasTag(friday, "pasta") || hasTag(friday, "stew")) score += 20;
    if (friday.costTier === "PREMIUM") score += 18;
    if (friday.isSoup) score -= 45;
    if (isVeg(friday)) score -= 35;
  }

  const allergenLoad = meals.reduce((sum, meal) => sum + (meal.allergens?.length ?? 0), 0);
  score -= allergenLoad * 2;

  const uniqueTitles = new Set(meals.map((meal) => normalizeTitle(meal.title)));
  if (uniqueTitles.size !== meals.length) score -= 500;

  if (meals.filter((m) => m.isFishDish).length > MAX_FISH_PER_WEEK) score -= 500;
  if (meals.filter((m) => m.isSoup).length > MAX_SOUP_PER_WEEK) score -= 500;
  if (meals.filter(isVeg).length > MAX_VEG_PER_WEEK) score -= 500;

  return score;
}

function buildWeekCandidate(
  normalPool: Meal[],
  fridayPool: Meal[],
  avoidTitles: Set<string>
): WeekCandidate | null {
  const state = {
    usedTitles: new Set([...avoidTitles].map(normalizeTitle)),
    usedStyles: new Set<string>(),
    usedStylesInOrder: [] as string[],
    usedTags: new Set<string>(),
    usedMethods: new Set<string>(),
    fishUsed: 0,
    soupUsed: 0,
    vegUsed: 0,
  };

  const week: Meal[] = [];

  for (let i = 0; i < WEEK_DAYS - 1; i += 1) {
    const meal = pickForDay(normalPool, state, i, false);
    if (!meal) return null;

    week.push(snapshotMeal(meal));
    registerMeal(meal, state);
  }

  const fridayMeal = pickForDay(fridayPool.length ? fridayPool : normalPool, state, 4, true);
  if (!fridayMeal) return null;

  week.push(snapshotMeal(fridayMeal));
  registerMeal(fridayMeal, state);

  return {
    meals: week,
    score: weekScore(week),
  };
}

function buildFallbackWeek(
  normalPool: Meal[],
  fridayPool: Meal[],
  avoidTitles: Set<string>
): Meal[] {
  const state = {
    usedTitles: new Set([...avoidTitles].map(normalizeTitle)),
    usedStyles: new Set<string>(),
    usedStylesInOrder: [] as string[],
    usedTags: new Set<string>(),
    usedMethods: new Set<string>(),
    fishUsed: 0,
    soupUsed: 0,
    vegUsed: 0,
  };

  const week: Meal[] = [];

  for (let i = 0; i < WEEK_DAYS; i += 1) {
    const pool = i === WEEK_DAYS - 1 && fridayPool.length ? fridayPool : normalPool;

    const meal =
      pool
        .filter(isValidMeal)
        .filter((m) => !state.usedTitles.has(normalizeTitle(m.title)))
        .sort(
          (a, b) =>
            mealScore(b, {
              friday: i === WEEK_DAYS - 1,
              usedStyles: state.usedStyles,
              usedTags: state.usedTags,
              usedMethods: state.usedMethods,
              dayIndex: i,
            }) -
            mealScore(a, {
              friday: i === WEEK_DAYS - 1,
              usedStyles: state.usedStyles,
              usedTags: state.usedTags,
              usedMethods: state.usedMethods,
              dayIndex: i,
            })
        )[0] ?? null;

    if (!meal) {
      throw new Error("Kunne ikke bygge fallback-uke. Sjekk at basebanken har nok gyldige retter.");
    }

    week.push(snapshotMeal(meal));
    registerMeal(meal, state);
  }

  return week;
}

export function generateWeekMenu({
  baseMeals,
  fridayMeals,
  avoidTitles,
}: GenerateWeekMenuArgs): Meal[] {
  const normalPool = baseMeals.filter(isValidMeal);
  const premiumFridayPool = fridayMeals.filter(isValidMeal);

  if (normalPool.length < MIN_POOL_SIZE) {
    throw new Error(
      `Varmmatbank for liten etter filter: ${normalPool.length} retter tilgjengelig, minimum ${MIN_POOL_SIZE} kreves. Sjekk at retter er aktive og har nutritionPer100g.energyKcal.`
    );
  }

  let best: WeekCandidate | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = buildWeekCandidate(normalPool, premiumFridayPool, avoidTitles);
    if (!candidate) continue;

    if (!best || candidate.score > best.score) {
      best = candidate;
    }
  }

  const week = best?.meals ?? buildFallbackWeek(normalPool, premiumFridayPool, avoidTitles);

  if (week.length !== WEEK_DAYS) {
    throw new Error(`Generatorfeil: uke fikk ${week.length} dager, forventet ${WEEK_DAYS}.`);
  }

  const uniqueTitles = new Set(week.map((meal) => normalizeTitle(meal.title)));
  if (uniqueTitles.size !== week.length) {
    throw new Error("Generatorfeil: samme rett ble valgt flere ganger i samme uke.");
  }

  return week;
}
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
  /** Deterministisk seed (f.eks. providerRef + ISO-uke). Rollout sender alltid eksplisitt seed. */
  selectionSeed?: string;
  /** Reserved for future tier-specific scoring; optional and ignored in v1. */
  planTier?: PlanTier;
  /** Eksisterende kanoniske dager (0=man … 4=fre) — registreres i generator-state før nye plukk. */
  prefilledDays?: ReadonlyMap<number, Meal>;
};

/** Ukedag-pin (Mon=0 … Fri=4) — klasse-tags fra kurert bank. */
export const WEEKDAY_CATEGORY_PINS: Readonly<Record<number, string>> = {
  1: "suppe",
  3: "fisk",
  4: "fredagskos",
};

const TARGET_PRICE = 90;
const WEEK_DAYS = 5;
const MIN_POOL_SIZE = 50;
const DEFAULT_COST_PER_PORTION = 65;
const FREDAGSKOS_DEPRIORITIZE_SCORE = 18;

export type PickRelax = {
  allowOverlap: boolean;
  allowSameStyle: boolean;
  allowReuseMethod: boolean;
  /** Kun for pinnet dag etter normal fallback — aldri bytt kategori. */
  allowTitleCooldown?: boolean;
};

const STRICT_RELAX: PickRelax = {
  allowOverlap: false,
  allowSameStyle: false,
  allowReuseMethod: false,
};

export type GenerateWeekMenuResult = {
  days: (Meal | null)[];
  /** Dag-indekser (0=man) der pinnet pool var tom etter cooldown-relax. */
  unfilledDayIndices: number[];
};

/** Stabil seed-streng for rollout-plukk (provider + ukestart mandag ISO). */
export function buildRolloutSelectionSeed(providerRef: string, weekMondayIso: string): string {
  return `${String(providerRef ?? "").trim()}\0${String(weekMondayIso ?? "").trim()}`;
}

/**
 * Synk klasse-tag → variasjons-boolean (seed skal sette begge; dette er defensiv binding).
 * Meal bruker isFishDish / isSoup / isVegetarian — ikke isVeg.
 */
export function bindMealCategoryBooleans(meal: Meal): Meal {
  const tags = meal.tags ?? [];
  return {
    ...meal,
    isFishDish: meal.isFishDish === true || tags.includes("fisk"),
    isSoup: meal.isSoup === true || tags.includes("suppe"),
    isVegetarian:
      meal.isVegetarian === true || tags.includes("veg") || tags.includes("vegan"),
  };
}

export function getWeekdayCategoryPin(dayIndex: number): string | undefined {
  return WEEKDAY_CATEGORY_PINS[dayIndex];
}

export function mealHasTag(meal: Meal, tag: string): boolean {
  return Array.isArray(meal.tags) && meal.tags.includes(tag);
}

/** Slå sammen meal-pooler på _id (base ∪ friday etter tier-intersection). */
export function mergeMealPoolsById(...pools: Meal[][]): Meal[] {
  const byId = new Map<string, Meal>();
  for (const pool of pools) {
    for (const meal of pool) {
      const id = String(meal._id ?? "").trim();
      if (id) byId.set(id, meal);
    }
  }
  return [...byId.values()];
}

/** Retter reservert for en annen dags pin — gjelder alle dager (boolean + fredagskos-tag). */
export function isReservedForOtherPinDay(meal: Meal, dayIndex: number): boolean {
  const bound = bindMealCategoryBooleans(meal);
  const pin = getWeekdayCategoryPin(dayIndex);
  if (bound.isFishDish && pin !== "fisk") return true;
  if (bound.isSoup && pin !== "suppe") return true;
  if (mealHasTag(bound, "fredagskos") && pin !== "fredagskos") return true;
  return false;
}

/** Pinnet dag: tag + bool (fisk/suppe) for å fange protein uten klasse-tag. */
function matchesDayPin(meal: Meal, pin: string): boolean {
  if (pin === "fisk") return mealHasTag(meal, "fisk") || meal.isFishDish === true;
  if (pin === "suppe") return mealHasTag(meal, "suppe") || meal.isSoup === true;
  return mealHasTag(meal, pin);
}

export function buildPoolForDay(bankMeals: Meal[], dayIndex: number): Meal[] {
  const valid = bankMeals.filter(isValidMeal).map(bindMealCategoryBooleans);
  const pin = getWeekdayCategoryPin(dayIndex);
  let pool = valid.filter((m) => !isReservedForOtherPinDay(m, dayIndex));
  if (pin) {
    pool = pool.filter((m) => matchesDayPin(m, pin));
  }
  return pool;
}

function hashStringToUint32(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — deterministisk PRNG fra 32-bit seed. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Per-rett jitter i [-4, 4] — erstatter Math.random i sort, reproduserbart gitt selectionSeed. */
export function seededSortJitter(mealId: string, selectionSeed: string): number {
  const prng = mulberry32(hashStringToUint32(`${selectionSeed}:${mealId}`));
  return (prng() - 0.5) * 8;
}

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

function isVeg(meal: Meal) {
  return meal.isVegetarian === true || mealHasTag(meal, "veg") || mealHasTag(meal, "vegan");
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
  context: { dayIndex: number; usedStyles: Set<string>; usedTags: Set<string> },
): number {
  let score = 0;

  score += margin(meal) * 2.2;
  score += (meal.nutritionScore ?? 6) * 2;

  if (meal.costTier === "BUDGET") score += 8;
  if (meal.costTier === "STANDARD" || !meal.costTier) score += 6;
  if (meal.costTier === "PREMIUM") score -= 10;

  if (mealHasTag(meal, "chicken")) score += 7;
  if (mealHasTag(meal, "beef")) score += 7;
  if (mealHasTag(meal, "pork")) score += 6;
  if (mealHasTag(meal, "lamb")) score += 5;
  if (mealHasTag(meal, "stew")) score += 4;
  if (mealHasTag(meal, "pasta")) score += 3;

  if (isVeg(meal)) score -= 12;
  if (meal.isFishDish) score -= 2;
  if (meal.isSoup) score -= 1;

  if (meal.allergens?.length) score += 1;
  if (meal.nutritionPer100g) score += 2;

  if (
    (context.dayIndex === 0 || context.dayIndex === 2) &&
    mealHasTag(meal, "fredagskos")
  ) {
    score -= FREDAGSKOS_DEPRIORITIZE_SCORE;
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

function sortCandidatesSeeded(
  meals: Meal[],
  context: { dayIndex: number; usedStyles: Set<string>; usedTags: Set<string> },
  selectionSeed: string,
): Meal[] {
  return [...meals]
    .filter(isValidMeal)
    .map(bindMealCategoryBooleans)
    .sort((a, b) => {
      const scoreA = scoreMeal(a, context) + seededSortJitter(a._id, selectionSeed);
      const scoreB = scoreMeal(b, context) + seededSortJitter(b._id, selectionSeed);
      const diff = scoreB - scoreA;
      if (diff !== 0) return diff;
      return a._id.localeCompare(b._id);
    });
}

type GeneratorState = {
  /** Titler allerede valgt i denne ukegenereringen — aldri relakseres. */
  usedTitles: Set<string>;
  /** Ekstern tittel-cooldown (historiske menuDays) — kan relakseres på pin-dag. */
  avoidTitles: Set<string>;
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

/** Avvisningsregel — fisk/suppe/veg max-1 relakseres aldri; ekstern tittel-cooldown kan relakseres på pin-dag. */
function classifyPickRejection(meal: Meal, state: MealPickState, relax: PickRelax): RejectReason | null {
  const titleKey = normalizeTitle(meal.title);
  if (state.usedTitles.has(titleKey)) return "rejectTitleCooldown";
  if (!relax.allowTitleCooldown && state.avoidTitles.has(titleKey)) return "rejectTitleCooldown";
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
  dayIndex: number,
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
    dayIndex,
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
  const bound = bindMealCategoryBooleans(meal);
  state.usedTitles.add(normalizeTitle(bound.title));

  if (bound.kitchenStyle) {
    state.usedStyles.add(bound.kitchenStyle);
    state.usedStylesInOrder.push(bound.kitchenStyle);
  }

  for (const tag of bound.tags ?? []) {
    state.usedTags.add(tag);
  }

  for (const m of normalizeMeaningfulTags(bound.tags ?? [])) {
    state.usedMeaningfulTags.add(m);
  }

  if (bound.method) {
    state.usedMethods.add(bound.method);
    state.usedTags.add(`method:${bound.method}`);
  }

  if (bound.isFishDish) state.fishUsed = true;
  if (bound.isSoup) state.soupUsed = true;
  if (isVeg(bound)) state.vegUsed = true;
}

function pickBest(
  pool: Meal[],
  state: GeneratorState,
  dayIndex: number,
  debugLabel: string | undefined,
  relax: PickRelax,
  selectionSeed: string,
  options?: { skipDiagnose?: boolean },
): Meal | null {
  const ctx = { dayIndex, usedStyles: state.usedStyles, usedTags: state.usedTags };
  const sorted = sortCandidatesSeeded(pool, ctx, selectionSeed);

  const found = sorted.find((meal) => canUseMeal(meal, state, relax)) ?? null;
  if (!found && !options?.skipDiagnose && isMenuGeneratorDebug()) {
    diagnosePickBestFailure(debugLabel ?? "pickBest", sorted, state, dayIndex);
  }
  return found;
}

function pickBestWithFallback(
  pool: Meal[],
  state: GeneratorState,
  dayIndex: number,
  selectionSeed: string,
  debugLabel?: string,
): Meal | null {
  const tries: PickRelax[] = [
    { allowOverlap: false, allowSameStyle: false, allowReuseMethod: false },
    { allowOverlap: true, allowSameStyle: false, allowReuseMethod: false },
    { allowOverlap: true, allowSameStyle: true, allowReuseMethod: false },
    { allowOverlap: true, allowSameStyle: true, allowReuseMethod: true },
  ];

  for (let i = 0; i < tries.length; i += 1) {
    const relax = tries[i]!;
    const isLast = i === tries.length - 1;
    const meal = pickBest(pool, state, dayIndex, debugLabel, relax, selectionSeed, {
      skipDiagnose: !(isLast && isMenuGeneratorDebug()),
    });
    if (meal) {
      if (relax.allowOverlap || relax.allowSameStyle || relax.allowReuseMethod) {
        logRelaxation(debugLabel ?? "pick", relax);
      }
      return meal;
    }
  }

  if (isMenuGeneratorDebug()) {
    const ctx = { dayIndex, usedStyles: state.usedStyles, usedTags: state.usedTags };
    const sorted = sortCandidatesSeeded(pool, ctx, selectionSeed);
    diagnosePickBestFailure(`${debugLabel ?? "pick"}:fallback-exhausted`, sorted, state, dayIndex);
  }
  return null;
}

/** Pinnet dag: etter normal fallback, slipp tittel-cooldown innen samme pin-pool. */
function pickWithPinCooldownRelax(
  pool: Meal[],
  state: GeneratorState,
  dayIndex: number,
  selectionSeed: string,
  debugLabel: string,
): Meal | null {
  const relax: PickRelax = {
    allowOverlap: true,
    allowSameStyle: true,
    allowReuseMethod: true,
    allowTitleCooldown: true,
  };
  const meal = pickBest(pool, state, dayIndex, debugLabel, relax, selectionSeed);
  if (meal) {
    logRelaxation(debugLabel, relax);
  }
  return meal;
}

/** Siste utvei innen pin-pool: behold kategori + uke-tittel + max-1 fisk/suppe/veg, slipp variasjon. */
function pickPinEmergency(
  pool: Meal[],
  state: GeneratorState,
  dayIndex: number,
  selectionSeed: string,
  debugLabel: string,
): Meal | null {
  const ctx = { dayIndex, usedStyles: state.usedStyles, usedTags: state.usedTags };
  const sorted = sortCandidatesSeeded(pool, ctx, selectionSeed);
  for (const meal of sorted) {
    const bound = bindMealCategoryBooleans(meal);
    if (!isValidMeal(bound)) continue;
    const titleKey = normalizeTitle(bound.title);
    if (state.usedTitles.has(titleKey)) continue;
    if (bound.isFishDish && state.fishUsed) continue;
    if (bound.isSoup && state.soupUsed) continue;
    if (isVeg(bound) && state.vegUsed) continue;
    logRelaxation(`${debugLabel}:pin-emergency`, {
      allowOverlap: true,
      allowSameStyle: true,
      allowReuseMethod: true,
      allowTitleCooldown: true,
    });
    return bound;
  }
  return null;
}

/** Første rett i sortert liste som holder uke-hard constraints (unik tittel, max-1 fisk/suppe/veg). */
function pickFromSortedWithWeekHardConstraints(sorted: Meal[], state: GeneratorState): Meal | null {
  for (const meal of sorted) {
    const bound = bindMealCategoryBooleans(meal);
    if (!isValidMeal(bound)) continue;
    const titleKey = normalizeTitle(bound.title);
    if (state.usedTitles.has(titleKey)) continue;
    if (bound.isFishDish && state.fishUsed) continue;
    if (bound.isSoup && state.soupUsed) continue;
    if (isVeg(bound) && state.vegUsed) continue;
    return bound;
  }
  return null;
}

/**
 * Deterministisk bank-fallback når pin-pool er tom eller uttømt.
 * Pin-prioritet: prøv pin-match først, deretter bred bank — aldri random.
 */
function pickDeterministicBankFallback(
  bankMeals: Meal[],
  state: GeneratorState,
  dayIndex: number,
  selectionSeed: string,
  debugLabel: string,
): Meal | null {
  const pin = getWeekdayCategoryPin(dayIndex);
  const valid = bankMeals.filter(isValidMeal).map(bindMealCategoryBooleans);
  const ctx = { dayIndex, usedStyles: state.usedStyles, usedTags: state.usedTags };
  const sorted = sortCandidatesSeeded(valid, ctx, `${selectionSeed}:bank-fallback:${dayIndex}`);
  const relaxLogged: PickRelax = {
    allowOverlap: true,
    allowSameStyle: true,
    allowReuseMethod: true,
    allowTitleCooldown: true,
  };

  if (pin) {
    const pinMatches = sorted.filter((m) => matchesDayPin(m, pin));
    const fromPin = pickFromSortedWithWeekHardConstraints(pinMatches, state);
    if (fromPin) {
      logRelaxation(`${debugLabel}:pin-priority`, relaxLogged);
      return fromPin;
    }
  }

  const withoutOtherPinReserve = sorted.filter((m) => !isReservedForOtherPinDay(m, dayIndex));
  const bankPool = withoutOtherPinReserve.length > 0 ? withoutOtherPinReserve : sorted;
  const fromBank = pickFromSortedWithWeekHardConstraints(bankPool, state);
  if (fromBank) {
    logRelaxation(`${debugLabel}:bank-wide`, relaxLogged);
    return fromBank;
  }

  const absolute = pickFromSortedWithWeekHardConstraints(sorted, state);
  if (absolute) {
    logRelaxation(`${debugLabel}:bank-absolute`, relaxLogged);
    return absolute;
  }

  return null;
}

function pickForGeneratedDay(
  bankMeals: Meal[],
  state: GeneratorState,
  dayIndex: number,
  selectionSeed: string,
): Meal | null {
  const pool = buildPoolForDay(bankMeals, dayIndex);
  const pin = getWeekdayCategoryPin(dayIndex);

  let meal: Meal | null = null;

  if (pool.length > 0) {
    meal =
      pickBestWithFallback(pool, state, dayIndex, selectionSeed, `dag-${dayIndex + 1}`) ??
      (pin
        ? pickWithPinCooldownRelax(pool, state, dayIndex, selectionSeed, `dag-${dayIndex + 1}-pin-cooldown`)
        : null);

    if (!meal && pin) {
      meal = pickPinEmergency(pool, state, dayIndex, selectionSeed, `dag-${dayIndex + 1}`);
    }
  }

  if (!meal) {
    meal = pickDeterministicBankFallback(
      bankMeals,
      state,
      dayIndex,
      selectionSeed,
      `dag-${dayIndex + 1}`,
    );
  }

  if (meal) {
    return bindMealCategoryBooleans(meal);
  }

  const diag = formatPickFailureDiag(state, pool.length);
  throw new Error(
    `Kunne ikke fylle dag ${dayIndex + 1} (pin=${pin ?? "ingen"}) — bank-fallback uttømt. Diagnose: ${diag}`,
  );
}

/**
 * Første ukedags-rett som `generateWeekMenu` ville valgt (dag 1), uten å mutere ekstern state.
 */
export function pickFirstWeekdayMealForDiagnostics(
  baseMeals: Meal[],
  avoidTitles: Set<string>,
  options?: { selectionSeed?: string; /** @deprecated legacy scripts */ deterministicSort?: boolean },
): Meal | null {
  void options?.deterministicSort;
  const selectionSeed = options?.selectionSeed ?? "diag-default-seed";
  const state: GeneratorState = {
    usedTitles: new Set<string>(),
    avoidTitles: new Set([...avoidTitles].map(normalizeTitle)),
    usedStyles: new Set<string>(),
    usedStylesInOrder: [] as string[],
    usedTags: new Set<string>(),
    usedMeaningfulTags: new Set<string>(),
    usedMethods: new Set<string>(),
    fishUsed: false,
    soupUsed: false,
    vegUsed: false,
  };

  const bankMeals = mergeMealPoolsById(baseMeals);
  if (buildPoolForDay(bankMeals, 0).length < MIN_POOL_SIZE) return null;

  return pickBestWithFallback(buildPoolForDay(bankMeals, 0), state, 0, selectionSeed, "diag-dag-1");
}

function snapshotMeal(meal: Meal): Meal {
  const bound = bindMealCategoryBooleans(meal);
  return {
    _id: bound._id,
    title: bound.title,
    description: bound.description?.trim() || bound.title,
    tags: Array.isArray(bound.tags) ? [...bound.tags] : [],
    costTier: bound.costTier ?? "STANDARD",
    productionComplexity: bound.productionComplexity ?? "MEDIUM",
    nutritionScore: bound.nutritionScore ?? 7,
    allergens: Array.isArray(bound.allergens) ? [...bound.allergens] : [],
    mayContain: Array.isArray(bound.mayContain) ? [...bound.mayContain] : [],
    nutritionPer100g: bound.nutritionPer100g ?? null,
    nutritionNote: bound.nutritionNote,
    isActive: bound.isActive,
    season: Array.isArray(bound.season) ? [...bound.season] : [],
    kitchenStyle: bound.kitchenStyle ?? "international",
    method: bound.method,
    estimatedCostPerPortion: normalizeCost(bound),
    targetPricePerPortion: bound.targetPricePerPortion ?? TARGET_PRICE,
    isFishDish: bound.isFishDish === true,
    isSoup: bound.isSoup === true,
    isVegetarian: bound.isVegetarian === true || isVeg(bound),
    lastUsedDate: bound.lastUsedDate,
    usageCount: bound.usageCount,
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

function assertWeekInvariants(week: (Meal | null)[]): void {
  const filled = week.filter((m): m is Meal => m != null);

  if (week.length !== WEEK_DAYS) {
    throw new Error(`Generatorfeil: uke fikk ${week.length} dager, forventet ${WEEK_DAYS}.`);
  }

  if (filled.filter((m) => m.isFishDish).length > 1) {
    throw new Error("Generatorfeil: mer enn én fiskerett i samme uke.");
  }

  if (filled.filter((m) => m.isSoup).length > 1) {
    throw new Error("Generatorfeil: mer enn én suppe i samme uke.");
  }

  if (filled.filter(isVeg).length > 1) {
    throw new Error("Generatorfeil: mer enn én vegetarrett i samme uke.");
  }

  const uniqueTitles = new Set(filled.map((meal) => normalizeTitle(meal.title)));
  if (uniqueTitles.size !== filled.length) {
    throw new Error("Generatorfeil: samme rett ble valgt flere ganger i samme uke.");
  }
}

export function generateWeekMenu({
  baseMeals,
  fridayMeals,
  avoidTitles,
  selectionSeed,
  planTier: _planTier,
  prefilledDays,
}: GenerateWeekMenuArgs): GenerateWeekMenuResult {
  void _planTier;
  const seed = String(selectionSeed ?? "legacy-non-rollout").trim();

  const state: GeneratorState = {
    usedTitles: new Set<string>(),
    avoidTitles: new Set([...avoidTitles].map(normalizeTitle)),
    usedStyles: new Set<string>(),
    usedStylesInOrder: [] as string[],
    usedTags: new Set<string>(),
    usedMeaningfulTags: new Set<string>(),
    usedMethods: new Set<string>(),
    fishUsed: false,
    soupUsed: false,
    vegUsed: false,
  };

  const bankMeals = mergeMealPoolsById(baseMeals, fridayMeals);
  const mainPoolSize = buildPoolForDay(bankMeals, 0).length;

  if (mainPoolSize < MIN_POOL_SIZE) {
    throw new Error(
      `Varmmatbank for liten etter filter: ${mainPoolSize} hovedrett-kandidater (mandag-pool), minimum ${MIN_POOL_SIZE} kreves. ` +
        "Sjekk at retter er aktive og har nutritionPer100g.energyKcal.",
    );
  }

  const week: (Meal | null)[] = new Array(WEEK_DAYS).fill(null);

  for (let i = 0; i < WEEK_DAYS; i += 1) {
    const prefilled = prefilledDays?.get(i);
    if (prefilled) {
      week[i] = snapshotMeal(prefilled);
      registerMeal(prefilled, state);
    }
  }

  for (let i = 0; i < WEEK_DAYS; i += 1) {
    if (week[i]) continue;

    const meal = pickForGeneratedDay(bankMeals, state, i, seed);
    week[i] = snapshotMeal(meal);
    registerMeal(meal, state);
  }

  assertWeekInvariants(week);
  return { days: week, unfilledDayIndices: [] };
}

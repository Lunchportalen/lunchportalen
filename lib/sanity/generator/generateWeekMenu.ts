export type CostTier = "BUDGET" | "STANDARD" | "PREMIUM";

export type Meal = {
    _id: string;
    title: string;
    description?: string;
    tags?: string[];
    costTier?: CostTier;
    nutritionScore?: number;
    allergens?: string[];
    isActive?: boolean;
    season?: string[];
    kitchenStyle?: string;
    estimatedCostPerPortion?: number;
    isFishDish?: boolean;
    isSoup?: boolean;
    lastUsedDate?: string;
    usageCount?: number;
};

type GenerateWeekMenuArgs = {
    baseMeals: Meal[];
    fridayMeals: Meal[];
    avoidTitles: Set<string>;
};

const TARGET_PRICE = 90;
const WEEK_DAYS = 5;
const MIN_MARGIN_KR = 10;

function normalizeTitle(title?: string) {
    return (title ?? "").trim().toLowerCase();
}

function margin(meal: Meal) {
    return TARGET_PRICE - (meal.estimatedCostPerPortion ?? TARGET_PRICE);
}

function isValidMeal(meal: Meal) {
    if (meal.isActive === false) return false;
    if (!meal.title?.trim()) return false;
    if (typeof meal.estimatedCostPerPortion !== "number") return false;
    if (meal.estimatedCostPerPortion >= TARGET_PRICE) return false;
    if (margin(meal) < MIN_MARGIN_KR) return false;
    return true;
}

function scoreMeal(
    meal: Meal,
    context: {
        friday: boolean;
        usedStyles: Set<string>;
        usedTags: Set<string>;
    }
) {
    let score = 0;

    score += margin(meal) * 2.2;
    score += (meal.nutritionScore ?? 6) * 2;

    if (meal.costTier === "BUDGET") score += 8;
    if (meal.costTier === "STANDARD") score += 6;
    if (meal.costTier === "PREMIUM") score += context.friday ? 7 : -10;

    if (meal.kitchenStyle && !context.usedStyles.has(meal.kitchenStyle)) {
        score += 8;
    }

    for (const tag of meal.tags ?? []) {
        if (!context.usedTags.has(tag)) score += 3;
    }

    if (meal.isFishDish) score -= 2;
    if (meal.isSoup) score -= 1;

    if (typeof meal.usageCount === "number") {
        score -= Math.min(meal.usageCount, 20) * 0.5;
    }

    return score;
}

function sortCandidates(
    meals: Meal[],
    context: {
        friday: boolean;
        usedStyles: Set<string>;
        usedTags: Set<string>;
    }
) {
    return [...meals]
        .filter(isValidMeal)
        .sort((a, b) => scoreMeal(b, context) - scoreMeal(a, context));
}

function canUseMeal(
    meal: Meal,
    state: {
        usedTitles: Set<string>;
        fishUsed: boolean;
        soupUsed: boolean;
    }
) {
    const title = normalizeTitle(meal.title);

    if (state.usedTitles.has(title)) return false;
    if (meal.isFishDish && state.fishUsed) return false;
    if (meal.isSoup && state.soupUsed) return false;

    return true;
}

function registerMeal(
    meal: Meal,
    state: {
        usedTitles: Set<string>;
        usedStyles: Set<string>;
        usedTags: Set<string>;
        fishUsed: boolean;
        soupUsed: boolean;
    }
) {
    state.usedTitles.add(normalizeTitle(meal.title));

    if (meal.kitchenStyle) {
        state.usedStyles.add(meal.kitchenStyle);
    }

    for (const tag of meal.tags ?? []) {
        state.usedTags.add(tag);
    }

    if (meal.isFishDish) state.fishUsed = true;
    if (meal.isSoup) state.soupUsed = true;
}

function pickBest(
    pool: Meal[],
    state: {
        usedTitles: Set<string>;
        usedStyles: Set<string>;
        usedTags: Set<string>;
        fishUsed: boolean;
        soupUsed: boolean;
    },
    friday: boolean
) {
    const sorted = sortCandidates(pool, {
        friday,
        usedStyles: state.usedStyles,
        usedTags: state.usedTags,
    });

    return sorted.find((meal) => canUseMeal(meal, state)) ?? null;
}

export function generateWeekMenu({
    baseMeals,
    fridayMeals,
    avoidTitles,
}: GenerateWeekMenuArgs): Meal[] {
    const state = {
        usedTitles: new Set([...avoidTitles].map(normalizeTitle)),
        usedStyles: new Set<string>(),
        usedTags: new Set<string>(),
        fishUsed: false,
        soupUsed: false,
    };

    const week: Meal[] = [];

    const normalPool = baseMeals.filter(isValidMeal);
    const fridayPool = fridayMeals.filter(isValidMeal);

    if (normalPool.length < 50) {
        throw new Error(
            "Varmmatbank for liten etter filter. Minst 50 aktive og lønnsomme retter kreves."
        );
    }

    for (let i = 0; i < WEEK_DAYS - 1; i++) {
        const meal = pickBest(normalPool, state, false);

        if (!meal) {
            throw new Error("Kunne ikke fylle mandag–torsdag med gjeldende regler.");
        }

        week.push(meal);
        registerMeal(meal, state);
    }

    const fridayMeal = pickBest(fridayPool.length ? fridayPool : normalPool, state, true);

    if (!fridayMeal) {
        throw new Error("Kunne ikke velge fredagsrett med gjeldende regler.");
    }

    week.push(fridayMeal);
    registerMeal(fridayMeal, state);

    if (week.length !== WEEK_DAYS) {
        throw new Error("Generatorfeil: uke må ha nøyaktig 5 hverdager.");
    }

    if (week.filter((meal) => meal.isFishDish).length > 1) {
        throw new Error("Generatorfeil: mer enn én fiskerett i samme uke.");
    }

    if (week.filter((meal) => meal.isSoup).length > 1) {
        throw new Error("Generatorfeil: mer enn én suppe i samme uke.");
    }

    return week;
}
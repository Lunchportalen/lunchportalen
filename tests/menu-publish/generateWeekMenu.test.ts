import { describe, expect, it, vi } from "vitest";



import {

  WEEKDAY_CATEGORY_PINS,

  bindMealCategoryBooleans,

  buildPoolForDay,

  buildRolloutSelectionSeed,

  generateWeekMenu,

  isReservedForOtherPinDay,

  mealHasTag,

  mulberry32,

  seededSortJitter,

  type Meal,

} from "@/lib/menu-publish/generateWeekMenu";



const NUTRITION = { energyKcal: 100, proteinG: 10, carbohydratesG: 12, fatG: 6, saltG: 0.8 };



function buildPinnedPool(prefix: string): { base: Meal[]; friday: Meal[] } {

  const styles = ["international", "nordic", "asian", "italian", "mediterranean", "french"] as const;

  const tags = ["chicken", "beef", "pork", "lamb", "turkey", "duck"] as const;

  const base: Meal[] = [];



  for (let i = 0; i < 80; i += 1) {

    base.push({

      _id: `${prefix}-main-${i}`,

      title: `Hovedrett ${prefix}-${i}`,

      description: `Besk ${i}`,

      tags: [tags[i % tags.length]!],

      costTier: "STANDARD",

      nutritionPer100g: { ...NUTRITION },

      nutritionScore: 7,

      estimatedCostPerPortion: 70,

      allergens: [],

      isActive: true,

      kitchenStyle: styles[i % styles.length],

      method: `method-${i % 11}`,

    });

  }



  for (let i = 0; i < 20; i += 1) {

    base.push({

      _id: `${prefix}-suppe-${i}`,

      title: `Tomatsuppe ${prefix}-${i}`,

      tags: ["suppe", "chicken"],

      costTier: "STANDARD",

      nutritionPer100g: { ...NUTRITION },

      isSoup: true,

      isActive: true,

      kitchenStyle: styles[(i + 1) % styles.length],

      method: `suppe-${i % 7}`,

    });

  }



  for (let i = 0; i < 20; i += 1) {

    base.push({

      _id: `${prefix}-fisk-${i}`,

      title: `Stekt torsk ${prefix}-${i}`,

      tags: ["fisk"],

      costTier: "STANDARD",

      nutritionPer100g: { ...NUTRITION },

      isFishDish: true,

      isActive: true,

      kitchenStyle: styles[(i + 2) % styles.length],

      method: `fisk-${i % 7}`,

    });

  }



  for (let i = 0; i < 20; i += 1) {

    base.push({

      _id: `${prefix}-fre-${i}`,

      title: `Fredagskos ${prefix} taco-${i}`,

      tags: ["fredagskos", "pork"],

      costTier: "STANDARD",

      nutritionPer100g: { ...NUTRITION },

      estimatedCostPerPortion: 55,

      isActive: true,

      kitchenStyle: styles[(i + 3) % styles.length],

      method: `fre-${i % 9}`,

    });

  }



  for (let i = 0; i < 6; i += 1) {

    base.push({

      _id: `${prefix}-veg-${i}`,

      title: `Veg ${prefix}-${i}`,

      tags: ["veg"],

      costTier: "STANDARD",

      isVegetarian: true,

      nutritionPer100g: { ...NUTRITION },

      isActive: true,

      kitchenStyle: styles[(i + 4) % styles.length],

    });

  }



  return { base, friday: base };

}



describe("bindMealCategoryBooleans", () => {

  it("mapper klasse-tags til isFishDish/isSoup/isVegetarian på Meal", () => {

    const bound = bindMealCategoryBooleans({

      _id: "x",

      title: "Test",

      tags: ["fisk", "suppe", "veg"],

      nutritionPer100g: { ...NUTRITION },

    });

    expect(bound.isFishDish).toBe(true);

    expect(bound.isSoup).toBe(true);

    expect(bound.isVegetarian).toBe(true);

  });

});



describe("generateWeekMenu determinisme", () => {

  const { base: baseMeals, friday: fridayMeals } = buildPinnedPool("det");

  const seed = buildRolloutSelectionSeed("provider-a", "2026-06-01");



  it("2× kjøring med samme seed gir identisk week[]", () => {

    const avoid = new Set<string>();

    const a = generateWeekMenu({ baseMeals, fridayMeals, avoidTitles: avoid, selectionSeed: seed });

    const b = generateWeekMenu({ baseMeals, fridayMeals, avoidTitles: avoid, selectionSeed: seed });

    expect(a.days.map((m) => m?._id)).toEqual(b.days.map((m) => m?._id));

  });



  it("ulike seeds kan gi ulike menyer", () => {

    const avoid = new Set<string>();

    const a = generateWeekMenu({

      baseMeals,

      fridayMeals,

      avoidTitles: avoid,

      selectionSeed: buildRolloutSelectionSeed("provider-a", "2026-06-01"),

    });

    const b = generateWeekMenu({

      baseMeals,

      fridayMeals,

      avoidTitles: avoid,

      selectionSeed: buildRolloutSelectionSeed("provider-a", "2026-06-08"),

    });

    const sameIds = a.days.every((m, i) => m?._id === b.days[i]?._id);

    expect(sameIds).toBe(false);

  });



  it("seededSortJitter er stabil per mealId + seed", () => {

    expect(seededSortJitter("meal-1", seed)).toBe(seededSortJitter("meal-1", seed));

    expect(seededSortJitter("meal-1", seed)).not.toBe(seededSortJitter("meal-2", seed));

  });



  it("mulberry32 er deterministisk", () => {

    const a = mulberry32(12345);

    const b = mulberry32(12345);

    expect([a(), a(), a()]).toEqual([b(), b(), b()]);

  });

});



describe("generateWeekMenu ukedag-pins", () => {

  const { base: baseMeals, friday: fridayMeals } = buildPinnedPool("pin");

  const seed = buildRolloutSelectionSeed("provider-a", "2026-06-01");



  it("tir suppe · tor fisk · fre fredagskos; man/ons uten suppe/fisk", () => {

    const { days } = generateWeekMenu({

      baseMeals,

      fridayMeals,

      avoidTitles: new Set(),

      selectionSeed: seed,

    });



    expect(days).toHaveLength(5);

    expect(days.every((m) => m != null)).toBe(true);



    expect(mealHasTag(days[1]!, "suppe")).toBe(true);

    expect(days[1]!.isSoup).toBe(true);



    expect(mealHasTag(days[3]!, "fisk")).toBe(true);

    expect(days[3]!.isFishDish).toBe(true);



    expect(mealHasTag(days[4]!, "fredagskos")).toBe(true);



    for (const idx of [0, 2, 4]) {

      expect(mealHasTag(days[idx]!, "suppe")).toBe(false);

      expect(mealHasTag(days[idx]!, "fisk")).toBe(false);

      expect(days[idx]!.isFishDish).toBe(false);

    }

    expect(days[1]!.isFishDish).toBe(false);

  });



  it("tom pin-pool: bank-fallback fyller tirsdag deterministisk", () => {

    const mainOnly: Meal[] = [];

    const tags = ["chicken", "beef", "pork", "lamb", "turkey", "duck"] as const;

    const styles = ["international", "nordic", "asian", "italian", "mediterranean", "french"] as const;

    for (let i = 0; i < 80; i += 1) {

      mainOnly.push({

        _id: `only-main-${i}`,

        title: `Kun hoved ox-${i}`,

        tags: [tags[i % tags.length]!],

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: styles[i % styles.length],

        method: `m-${i % 11}`,

      });

    }

    for (let i = 0; i < 20; i += 1) {

      mainOnly.push({

        _id: `only-fisk-${i}`,

        title: `Fisk laks-${i}`,

        tags: ["fisk"],

        isFishDish: true,

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: styles[i % styles.length],

      });

    }

    for (let i = 0; i < 20; i += 1) {

      mainOnly.push({

        _id: `only-fre-${i}`,

        title: `Fredag kos-${i}`,

        tags: ["fredagskos"],

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: styles[i % styles.length],

      });

    }



    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { days, unfilledDayIndices } = generateWeekMenu({

      baseMeals: mainOnly,

      fridayMeals: mainOnly,

      avoidTitles: new Set(),

      selectionSeed: seed,

    });

    errSpy.mockRestore();



    expect(unfilledDayIndices).toEqual([]);

    expect(days[1]).not.toBeNull();

    expect(days[0]).not.toBeNull();

    expect(days[2]).not.toBeNull();

    expect(mealHasTag(days[3]!, "fisk")).toBe(true);

    expect(mealHasTag(days[4]!, "fredagskos")).toBe(true);

  });



  it("cooldown-relax innen pin beholder kategori suppe", () => {

    const soups: Meal[] = [];

    for (let i = 0; i < 60; i += 1) {

      soups.push({

        _id: `main-x-${i}`,

        title: `Hoved x-${i}`,

        tags: ["beef"],

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: "nordic",

        method: `mx-${i}`,

      });

    }

    const suppeTitle = "Ene suppen";

    soups.push({

      _id: "suppe-1",

      title: suppeTitle,

      tags: ["suppe"],

      isSoup: true,

      nutritionPer100g: { ...NUTRITION },

      isActive: true,

      kitchenStyle: "nordic",

    });

    for (let i = 0; i < 20; i += 1) {

      soups.push({

        _id: `fisk-x-${i}`,

        title: `Fisk x-${i}`,

        tags: ["fisk"],

        isFishDish: true,

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: "nordic",

      });

    }

    for (let i = 0; i < 20; i += 1) {

      soups.push({

        _id: `fre-x-${i}`,

        title: `Fre x-${i}`,

        tags: ["fredagskos"],

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: "nordic",

      });

    }



    const avoid = new Set([suppeTitle.trim().toLowerCase()]);

    const { days } = generateWeekMenu({

      baseMeals: soups,

      fridayMeals: soups,

      avoidTitles: avoid,

      selectionSeed: seed,

    });



    expect(mealHasTag(days[1]!, "suppe")).toBe(true);

  });

});



describe("generateWeekMenu prefilledDays", () => {

  const { base: baseMeals, friday: fridayMeals } = buildPinnedPool("prefill");

  const seed = buildRolloutSelectionSeed("provider-a", "2026-06-01");



  it("beholder kanonisk mandag og genererer resten med pins", () => {

    const canonical: Meal = {

      _id: "existing-monday",

      title: "Kanonisk mandag X",

      description: "Fra eksisterende menuDay",

      tags: ["beef"],

      nutritionPer100g: { ...NUTRITION },

      isActive: true,

      kitchenStyle: "norwegian",

    };

    const prefilledDays = new Map<number, Meal>([[0, canonical]]);

    const { days } = generateWeekMenu({

      baseMeals,

      fridayMeals,

      avoidTitles: new Set([canonical.title.trim().toLowerCase()]),

      selectionSeed: seed,

      prefilledDays,

    });

    expect(days[0]!.title).toBe("Kanonisk mandag X");

    expect(mealHasTag(days[1]!, "suppe")).toBe(true);

  });



  it("buildPoolForDay respekterer WEEKDAY_CATEGORY_PINS", () => {

    expect(WEEKDAY_CATEGORY_PINS[1]).toBe("suppe");

    const pool = buildPoolForDay(baseMeals, 1);

    expect(pool.length).toBeGreaterThan(0);

    expect(pool.every((m) => mealHasTag(m, "suppe") || m.isSoup === true)).toBe(true);

  });

});



describe("buildPoolForDay pin-reservasjon (A.2)", () => {

  const seed = buildRolloutSelectionSeed("provider-a", "2026-06-01");

  it("mandag-pool ekskluderer isFishDish uten fisk-tag (reke-wok)", () => {

    const bank: Meal[] = [];

    for (let i = 0; i < 60; i += 1) {

      bank.push({

        _id: `main-${i}`,

        title: `Hoved ox-${i}`,

        tags: ["beef"],

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: "nordic",

        method: `m-${i}`,

      });

    }

    for (let i = 0; i < 15; i += 1) {

      bank.push({

        _id: `reke-wok-${i}`,

        title: `Reke-wok variant-${i}`,

        tags: ["wok"],

        isFishDish: true,

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: "asian",

        method: `wok-${i}`,

      });

    }

    const monPool = buildPoolForDay(bank, 0);

    expect(monPool.every((m) => !m.isFishDish)).toBe(true);

    expect(monPool.some((m) => m._id.startsWith("reke-wok"))).toBe(false);

  });



  it("torsdag fylles når mange isFishDish uten fisk-tag finnes i banken", () => {

    const bank: Meal[] = [];

    for (let i = 0; i < 80; i += 1) {

      bank.push({

        _id: `main-${i}`,

        title: `Hoved ox-${i}`,

        tags: ["beef"],

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: "nordic",

        method: `m-${i % 11}`,

      });

    }

    for (let i = 0; i < 40; i += 1) {

      bank.push({

        _id: `reke-wok-${i}`,

        title: `Reke-wok variant-${i}`,

        tags: ["wok"],

        isFishDish: true,

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: "asian",

        method: `wok-${i % 7}`,

      });

    }

    for (let i = 0; i < 20; i += 1) {

      bank.push({

        _id: `suppe-${i}`,

        title: `Suppe variant-${i}`,

        tags: ["suppe"],

        isSoup: true,

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: "nordic",

      });

    }

    for (let i = 0; i < 20; i += 1) {

      bank.push({

        _id: `fisk-tag-${i}`,

        title: `Torsk klassisk-${i}`,

        tags: ["fisk"],

        isFishDish: true,

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: "nordic",

      });

    }

    for (let i = 0; i < 20; i += 1) {

      bank.push({

        _id: `fre-${i}`,

        title: `Fredag kos-${i}`,

        tags: ["fredagskos"],

        nutritionPer100g: { ...NUTRITION },

        isActive: true,

        kitchenStyle: "nordic",

      });

    }



    const { days, unfilledDayIndices } = generateWeekMenu({

      baseMeals: bank,

      fridayMeals: bank,

      avoidTitles: new Set(),

      selectionSeed: seed,

    });



    expect(unfilledDayIndices).toEqual([]);

    expect(days[3]).not.toBeNull();

    expect(days[3]!.isFishDish).toBe(true);



    for (const idx of [0, 2, 4]) {

      expect(days[idx]!.isFishDish).toBe(false);

    }

  });



  it("isReservedForOtherPinDay: fisk bool reservert torsdag", () => {

    const rekeWok: Meal = {

      _id: "x",

      title: "Reke-wok",

      tags: ["wok"],

      isFishDish: true,

      nutritionPer100g: { ...NUTRITION },

    };

    expect(isReservedForOtherPinDay(rekeWok, 0)).toBe(true);

    expect(isReservedForOtherPinDay(rekeWok, 3)).toBe(false);

  });

});



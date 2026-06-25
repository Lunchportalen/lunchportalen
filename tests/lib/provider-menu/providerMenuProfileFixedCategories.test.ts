import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  LP_MENU_PROFILE_FIXED_CATEGORIES_ENV,
  LP_MENU_PROFILE_RESOLVER_ENV,
  isMenuProfileFixedCategoriesEnabled,
  isMenuProfileFixedCategoriesPanelEnabled,
} from "@/lib/menu-profile/featureFlag";
import { resolveNoCategoryRuntimeMapping } from "@/lib/menu-profile/noCategoryRuntimeMap";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import {
  buildMenuProfileFixedCategoryPresentation,
  buildProviderMenuFixedCategoryPresentation,
} from "@/lib/provider-menu/providerMenuProfileFixedCategories";

const BOTH_FLAGS = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_FIXED_CATEGORIES_ENV]: "true",
};

const RESOLVER_ONLY = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_FIXED_CATEGORIES_ENV]: "false",
};

describe("noCategoryRuntimeMap (G5b)", () => {
  it("maps known NO profile keys to existing runtime keys", () => {
    expect(resolveNoCategoryRuntimeMapping("paasmurt")).toEqual({
      runtimeCategoryKey: "paasmurt",
      runtimeLunchCategoryKey: "paasmurt",
      runtimeOrderChoiceKey: "paasmurt",
    });
    expect(resolveNoCategoryRuntimeMapping("salatboks")).toEqual({
      runtimeCategoryKey: "salat",
      runtimeLunchCategoryKey: "salatboks",
      runtimeOrderChoiceKey: "salatboks",
    });
    expect(resolveNoCategoryRuntimeMapping("varmrett")).toEqual({
      runtimeCategoryKey: "varmrett",
      runtimeLunchCategoryKey: "varmrett",
      runtimeOrderChoiceKey: "varmmat",
    });
    expect(resolveNoCategoryRuntimeMapping("thaimat")).toEqual({
      runtimeCategoryKey: "thai",
      runtimeLunchCategoryKey: "thaimat",
      runtimeOrderChoiceKey: "thaimat",
    });
  });

  it("returns null for unmapped profile keys", () => {
    expect(resolveNoCategoryRuntimeMapping("panini")).toBeNull();
    expect(resolveNoCategoryRuntimeMapping("enterprise_upgrade")).toBeNull();
  });
});

describe("featureFlag LP_MENU_PROFILE_FIXED_CATEGORIES (G5b)", () => {
  it("defaults OFF unless explicitly true or 1", () => {
    expect(isMenuProfileFixedCategoriesEnabled({})).toBe(false);
    expect(isMenuProfileFixedCategoriesEnabled({ [LP_MENU_PROFILE_FIXED_CATEGORIES_ENV]: "false" })).toBe(
      false,
    );
    expect(isMenuProfileFixedCategoriesEnabled({ [LP_MENU_PROFILE_FIXED_CATEGORIES_ENV]: "true" })).toBe(true);
    expect(isMenuProfileFixedCategoriesEnabled({ [LP_MENU_PROFILE_FIXED_CATEGORIES_ENV]: "1" })).toBe(true);
  });

  it("panel requires both resolver and fixed-categories flags", () => {
    expect(isMenuProfileFixedCategoriesPanelEnabled({})).toBe(false);
    expect(isMenuProfileFixedCategoriesPanelEnabled(RESOLVER_ONLY)).toBe(false);
    expect(isMenuProfileFixedCategoriesPanelEnabled(BOTH_FLAGS)).toBe(true);
  });
});

describe("providerMenuProfileFixedCategories (G5b)", () => {
  it("both flags OFF returns inactive presentation", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: {},
    });
    const presentation = buildProviderMenuFixedCategoryPresentation(result, "NOK", {});
    expect(presentation).toEqual({ active: false });
  });

  it("G5a ON + G5b OFF returns inactive fixed categories", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: RESOLVER_ONLY,
    });
    const presentation = buildProviderMenuFixedCategoryPresentation(result, "NOK", RESOLVER_ONLY);
    expect(presentation).toEqual({ active: false });
  });

  it("both flags ON + NO profile maps runtime categories", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "norwegian_company_lunch",
      env: BOTH_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildProviderMenuFixedCategoryPresentation(result, "NOK", BOTH_FLAGS);
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    const paasmurt = presentation.categories.find((c) => c.profileCategoryKey === "paasmurt");
    expect(paasmurt?.displayLabel).toBe("Påsmurt");
    expect(paasmurt?.runtimeCategoryKey).toBe("paasmurt");
    expect(paasmurt?.runtimeLunchCategoryKey).toBe("paasmurt");
    expect(paasmurt?.runtimeOrderChoiceKey).toBe("paasmurt");
    expect(paasmurt?.isPresentationOnly).toBe(false);
    expect(paasmurt?.isOrderRuntimeEnabled).toBe(true);
    expect(paasmurt?.statusLabelKey).toBe("activeInCurrentCatalog");

    const salatboks = presentation.categories.find((c) => c.profileCategoryKey === "salatboks");
    expect(salatboks?.runtimeCategoryKey).toBe("salat");
    expect(salatboks?.runtimeOrderChoiceKey).toBe("salatboks");

    const upgrade = presentation.categories.find((c) => c.profileCategoryKey === "enterprise_upgrade");
    expect(upgrade?.runtimeCategoryKey).toBeNull();
    expect(upgrade?.isPresentationOnly).toBe(true);
    expect(upgrade?.isOrderRuntimeEnabled).toBe(false);
  });

  it("both flags ON + IT profile is presentation-only", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "italian_office_lunch",
      env: BOTH_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildProviderMenuFixedCategoryPresentation(result, "EUR", BOTH_FLAGS);
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    const panini = presentation.categories.find((c) => c.profileCategoryKey === "panini");
    expect(panini?.displayLabel).toBe("Panini");
    expect(panini?.runtimeCategoryKey).toBeNull();
    expect(panini?.runtimeLunchCategoryKey).toBeNull();
    expect(panini?.isPresentationOnly).toBe(true);
    expect(panini?.isOrderRuntimeEnabled).toBe(false);
    expect(panini?.statusLabelKey).toBe("comingStructureNotOrderActive");

    expect(presentation.categories.some((c) => c.profileCategoryKey === "primo_del_giorno")).toBe(true);
  });

  it("both flags ON + DE profile is presentation-only", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "german_business_lunch",
      env: BOTH_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildProviderMenuFixedCategoryPresentation(result, "EUR", BOTH_FLAGS);
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    const broetchen = presentation.categories.find((c) => c.profileCategoryKey === "belegte_broetchen");
    expect(broetchen?.displayLabel).toBe("Belegte Brötchen");
    expect(broetchen?.runtimeCategoryKey).toBeNull();
    expect(broetchen?.isPresentationOnly).toBe(true);
    expect(broetchen?.isOrderRuntimeEnabled).toBe(false);

    expect(presentation.categories.some((c) => c.profileCategoryKey === "warme_mahlzeit")).toBe(true);
    expect(presentation.categories.some((c) => c.profileCategoryKey === "vegetarische_option")).toBe(true);
  });

  it("includes package tiers per category from profile package model", () => {
    const result = resolveMenuProfileForProvider({
      menuProfileId: "italian_office_lunch",
      env: BOTH_FLAGS,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.enabled) return;

    const presentation = buildMenuProfileFixedCategoryPresentation({
      profile: result.profile,
      currency: "EUR",
    });

    const bowl = presentation.categories.find((c) => c.profileCategoryKey === "bowl");
    expect(bowl?.packageTiers).toEqual(["LUXUS", "ENTERPRISE"]);
    expect(bowl?.packageTierLabels).toEqual(["Luxus", "Enterprise"]);
  });
});

describe("providerMenuProfileFixedCategories scope guard (G5b)", () => {
  const FORBIDDEN_PATHS = [
    "app/api/provider/menu-days",
    "app/api/provider/menu-catalog",
    "lib/provider-menu/menuDayPayload.ts",
    "lib/cms/menuDayContract.ts",
  ];

  it("presentation module does not import forbidden runtime paths", () => {
    const source = readFileSync(
      join(process.cwd(), "lib/provider-menu/providerMenuProfileFixedCategories.ts"),
      "utf8",
    );
    for (const forbidden of FORBIDDEN_PATHS) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toContain("lp_order_set");
    expect(source).not.toContain("lp_order_advance_status");
  });

  it("noCategoryRuntimeMap does not modify menuDayContract", () => {
    const source = readFileSync(join(process.cwd(), "lib/menu-profile/noCategoryRuntimeMap.ts"), "utf8");
    expect(source).not.toContain("PLAN_CATEGORIES");
    expect(source).not.toContain("ORDER_CHOICE_KEY_BY_CATEGORY");
    expect(source).not.toContain("EDITABLE_LUNCH_CATEGORY_KEYS");
  });
});

/**
 * G5d.1 — Pure runtime mapping layer tests (shadow-only, not wired to runtime).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { getMenuProfile, listMenuProfiles } from "@/lib/menu-profile/registry";
import { MENU_PROFILE_IDS } from "@/lib/menu-profile/types";
import {
  assertNoRuntimeEnablement,
  buildMenuProfileRuntimeMapping,
  isProfileCategoryRuntimeMapped,
  isProfileCategoryShadowOnly,
  listMappedNoCategories,
  listUnmappedProfileCategories,
  mapProfileCategoryToRuntime,
  WARM_DISH_PREVIEW_ID_PREFIX,
  type MenuProfileRuntimeMapping,
} from "@/lib/menu-profile/runtimeMapping";

const ROOT = process.cwd();

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function findCategory(
  mapping: MenuProfileRuntimeMapping,
  profileCategoryKey: string,
) {
  const category = mapping.categories.find((c) => c.profileCategoryKey === profileCategoryKey);
  expect(category, `category ${profileCategoryKey}`).toBeDefined();
  return category!;
}

describe("G5d.1 — NO profile maps existing categories to known runtime keys", () => {
  const noProfile = getMenuProfile("norwegian_company_lunch");
  const mapping = buildMenuProfileRuntimeMapping({ menuProfile: noProfile });

  test.each([
    ["paasmurt", "paasmurt", "paasmurt", "paasmurt"],
    ["salatboks", "salat", "salatboks", "salatboks"],
    ["sushi", "sushi", "sushi", "sushi"],
    ["pokebowl", "pokebowl", "pokebowl", "pokebowl"],
    ["thaimat", "thai", "thaimat", "thaimat"],
    ["varmrett", "varmrett", "varmrett", "varmmat"],
  ] as const)(
    "%s → category=%s lunch=%s order=%s",
    (profileKey, runtimeCategory, lunchCategory, orderChoice) => {
      const category = findCategory(mapping, profileKey);
      expect(category.runtimeCategoryKey).toBe(runtimeCategory);
      expect(category.runtimeLunchCategoryKey).toBe(lunchCategory);
      expect(category.runtimeOrderChoiceKey).toBe(orderChoice);
      expect(category.isMappedToExistingRuntime).toBe(true);
      expect(category.reasonCode).toBe("existing_no_runtime_mapping");
    },
  );
});

describe("G5d.1 — NO mapping remains shadow-only", () => {
  test("all enablement flags false and mapping is shadow-only", () => {
    const mapping = buildMenuProfileRuntimeMapping({
      menuProfile: getMenuProfile("norwegian_company_lunch"),
    });

    expect(mapping.isRuntimeEnabled).toBe(false);
    expect(mapping.isShadowOnly).toBe(true);

    for (const category of mapping.categories) {
      expect(category.canSaveToMenuDay).toBe(false);
      expect(category.canSaveToCatalog).toBe(false);
      expect(category.canPublish).toBe(false);
      expect(category.canOrder).toBe(false);
    }

    assertNoRuntimeEnablement(mapping);
    expect(listMappedNoCategories(mapping).length).toBe(6);
  });
});

describe("G5d.1 — IT profile categories are shadow-only", () => {
  const mapping = buildMenuProfileRuntimeMapping({
    menuProfile: getMenuProfile("italian_office_lunch"),
  });

  test.each(["panini", "insalata", "primo_del_giorno", "piatto_freddo"] as const)(
    "%s has null runtime keys",
    (profileKey) => {
      const category = findCategory(mapping, profileKey);
      expect(category.runtimeCategoryKey).toBeNull();
      expect(category.runtimeLunchCategoryKey).toBeNull();
      expect(category.runtimeOrderChoiceKey).toBeNull();
      expect(category.canPublish).toBe(false);
      expect(category.canOrder).toBe(false);
      expect(category.reasonCode).toBe("non_no_market_shadow_only");
    },
  );
});

describe("G5d.1 — DE profile categories are shadow-only", () => {
  const mapping = buildMenuProfileRuntimeMapping({
    menuProfile: getMenuProfile("german_business_lunch"),
  });

  test.each(["belegte_broetchen", "warme_mahlzeit", "vegetarische_option"] as const)(
    "%s has null runtime keys",
    (profileKey) => {
      const category = findCategory(mapping, profileKey);
      expect(category.runtimeCategoryKey).toBeNull();
      expect(category.runtimeLunchCategoryKey).toBeNull();
      expect(category.runtimeOrderChoiceKey).toBeNull();
      expect(category.reasonCode).toBe("non_no_market_shadow_only");
    },
  );
});

describe("G5d.1 — all non-NO profiles remain shadow-only", () => {
  test.each(
    MENU_PROFILE_IDS.filter((id) => id !== "norwegian_company_lunch").map((id) => [id] as const),
  )("%s mapping has no runtime enablement", (profileId) => {
    const mapping = buildMenuProfileRuntimeMapping({
      menuProfile: getMenuProfile(profileId),
    });

    expect(mapping.isRuntimeEnabled).toBe(false);
    expect(mapping.isShadowOnly).toBe(true);
    expect(mapping.market).not.toBe("NO");

    for (const category of mapping.categories) {
      expect(category.runtimeCategoryKey).toBeNull();
      expect(category.canPublish).toBe(false);
      expect(category.canOrder).toBe(false);
    }

    expect(listMappedNoCategories(mapping)).toEqual([]);
    assertNoRuntimeEnablement(mapping);
  });
});

describe("G5d.1 — warm-dish-preview IDs remain preview-only", () => {
  test("NO warm dish preview items are preview-only with informational runtime keys", () => {
    const mapping = buildMenuProfileRuntimeMapping({
      menuProfile: getMenuProfile("norwegian_company_lunch"),
    });

    expect(mapping.warmDishPreview.length).toBeGreaterThan(0);

    for (const item of mapping.warmDishPreview) {
      expect(item.warmDishPreviewId.startsWith(WARM_DISH_PREVIEW_ID_PREFIX)).toBe(true);
      expect(item.warmDishPreviewId).not.toMatch(/^[a-f0-9-]{36}$/i);
      expect(item.canApplyToMenu).toBe(false);
      expect(item.canPublish).toBe(false);
      expect(item.canOrder).toBe(false);
      expect(item.isPreviewOnly).toBe(true);
      expect(item.runtimeCategoryKey).toBe("varmrett");
      expect(item.runtimeOrderChoiceKey).toBe("varmmat");
      expect(item.reasonCode).toBe("warm_dish_preview_only");
    }
  });

  test("non-NO warm dish preview items have null runtime keys", () => {
    const mapping = buildMenuProfileRuntimeMapping({
      menuProfile: getMenuProfile("italian_office_lunch"),
    });

    for (const item of mapping.warmDishPreview) {
      expect(item.warmDishPreviewId.startsWith(WARM_DISH_PREVIEW_ID_PREFIX)).toBe(true);
      expect(item.runtimeCategoryKey).toBeNull();
      expect(item.runtimeOrderChoiceKey).toBeNull();
      expect(item.reasonCode).toBe("non_no_market_shadow_only");
    }
  });
});

describe("G5d.1 — enterprise_upgrade is not order category", () => {
  test("enterprise_upgrade has null runtime keys and canOrder=false", () => {
    const mapping = buildMenuProfileRuntimeMapping({
      menuProfile: getMenuProfile("norwegian_company_lunch"),
    });
    const upgrade = findCategory(mapping, "enterprise_upgrade");

    expect(upgrade.runtimeCategoryKey).toBeNull();
    expect(upgrade.runtimeLunchCategoryKey).toBeNull();
    expect(upgrade.runtimeOrderChoiceKey).toBeNull();
    expect(upgrade.canOrder).toBe(false);
    expect(upgrade.reasonCode).toBe("enterprise_upgrade_not_order_category");
  });
});

describe("G5d.1 — assertNoRuntimeEnablement catches accidental true", () => {
  const base = buildMenuProfileRuntimeMapping({
    menuProfile: getMenuProfile("norwegian_company_lunch"),
  });

  test("canPublish=true throws", () => {
    const bad = {
      ...base,
      categories: base.categories.map((c, i) =>
        i === 0 ? { ...c, canPublish: true as false } : c,
      ),
    } satisfies MenuProfileRuntimeMapping;
    expect(() => assertNoRuntimeEnablement(bad)).toThrow(/canPublish/);
  });

  test("canOrder=true throws", () => {
    const bad = {
      ...base,
      categories: base.categories.map((c, i) =>
        i === 0 ? { ...c, canOrder: true as false } : c,
      ),
    } satisfies MenuProfileRuntimeMapping;
    expect(() => assertNoRuntimeEnablement(bad)).toThrow(/canOrder/);
  });

  test("canSaveToMenuDay=true throws", () => {
    const bad = {
      ...base,
      categories: base.categories.map((c, i) =>
        i === 0 ? { ...c, canSaveToMenuDay: true as false } : c,
      ),
    } satisfies MenuProfileRuntimeMapping;
    expect(() => assertNoRuntimeEnablement(bad)).toThrow(/canSaveToMenuDay/);
  });

  test("isRuntimeEnabled=true throws", () => {
    const bad = { ...base, isRuntimeEnabled: true as false } satisfies MenuProfileRuntimeMapping;
    expect(() => assertNoRuntimeEnablement(bad)).toThrow(/isRuntimeEnabled/);
  });
});

describe("G5d.1 — unknown profile keys fail closed", () => {
  test("mapProfileCategoryToRuntime returns fail-closed mapping", () => {
    const mapping = mapProfileCategoryToRuntime("norwegian_company_lunch", "unknown_category_key");

    expect(mapping.runtimeCategoryKey).toBeNull();
    expect(mapping.runtimeLunchCategoryKey).toBeNull();
    expect(mapping.runtimeOrderChoiceKey).toBeNull();
    expect(mapping.reasonCode).toBe("missing_runtime_mapping");
    expect(mapping.canSaveToMenuDay).toBe(false);
    expect(mapping.canPublish).toBe(false);
    expect(mapping.canOrder).toBe(false);
  });

  test("custom noRuntimeMap returning null yields missing_runtime_mapping on NO", () => {
    const mapping = buildMenuProfileRuntimeMapping({
      menuProfile: getMenuProfile("norwegian_company_lunch"),
      noRuntimeMap: () => null,
    });

    const paasmurt = findCategory(mapping, "paasmurt");
    expect(paasmurt.runtimeCategoryKey).toBeNull();
    expect(paasmurt.reasonCode).toBe("missing_runtime_mapping");
    expect(listUnmappedProfileCategories(mapping).length).toBeGreaterThan(0);
  });
});

describe("G5d.1 — pure mapping helpers", () => {
  test("isProfileCategoryRuntimeMapped reflects NO bridge only", () => {
    expect(isProfileCategoryRuntimeMapped("norwegian_company_lunch", "paasmurt")).toBe(true);
    expect(isProfileCategoryRuntimeMapped("italian_office_lunch", "panini")).toBe(false);
  });

  test("isProfileCategoryShadowOnly is true for known profile categories", () => {
    expect(isProfileCategoryShadowOnly("norwegian_company_lunch", "paasmurt")).toBe(true);
    expect(isProfileCategoryShadowOnly("norwegian_company_lunch", "unknown")).toBe(false);
  });

  test("buildMenuProfileRuntimeMapping covers all registry profiles", () => {
    for (const profile of listMenuProfiles()) {
      const mapping = buildMenuProfileRuntimeMapping({ menuProfile: profile });
      expect(mapping.profileId).toBe(profile.id);
      expect(mapping.mappingVersion).toBe("g5d.1");
      assertNoRuntimeEnablement(mapping);
    }
  });
});

describe("G5d.1 — mapping imports do not pull runtime paths", () => {
  const FORBIDDEN_IMPORT_PATTERNS = [
    /from ["']@\/app\/api/,
    /from ["']@\/app\/\(app\)\/week/,
    /billing/i,
    /tripletex/i,
    /menu-publish/,
    /auto-rollout/,
    /lp_order_set/,
    /syncMenuServiceDayItems/,
    /menuDayPayload/,
  ];

  test("runtimeMapping.ts must not import protected runtime paths", () => {
    const src = readSource("lib/menu-profile/runtimeMapping.ts");
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      expect(src, `forbidden pattern ${pattern}`).not.toMatch(pattern);
    }
  });

  test("runtimeMappingTypes.ts has no runtime imports", () => {
    const src = readSource("lib/menu-profile/runtimeMappingTypes.ts");
    expect(src).not.toMatch(/from ["']@\/app\//);
    expect(src).not.toMatch(/menuDayPayload|tripletex|billing/i);
  });
});

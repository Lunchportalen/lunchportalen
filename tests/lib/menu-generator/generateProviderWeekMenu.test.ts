import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import {
  assertEmployeeSafePayload,
  generateProviderWeekMenu,
  getFixedDishBankForLocale,
  mapGeneratedWeekMenuToEmployeeSafe,
  mapGeneratedWeekMenuToProviderAdmin,
  resolveProviderMenuRuntimeProfile,
  resolveEconomyConfigForCountry,
} from "@/lib/menu-generator";
import { categoriesForTier } from "@/lib/menu-generator/tierRules";
import { buildStableChoiceKey, buildStableItemKey } from "@/lib/menu-generator/itemKeys";
import { EMPLOYEE_COMMERCIAL_FIELD_NAMES } from "../../fixtures/g5d0-runtime-contract.constants";

const PROVIDER_ID = "11111111-1111-4111-8111-111111111111";
const WEEK_START = "2026-07-06";

function generateForLocale(menuLocale: "nb-NO" | "sv-SE" | "da-DK" | "en-GB", tier: "BASIS" | "LUXUS" | "ENTERPRISE" = "LUXUS") {
  const countryMap = { "nb-NO": "NO", "sv-SE": "SE", "da-DK": "DK", "en-GB": "GB" } as const;
  const profileMap = {
    "nb-NO": "norwegian_company_lunch",
    "sv-SE": "swedish_lunch",
    "da-DK": "danish_office_lunch",
    "en-GB": "uk_office_lunch",
  } as const;

  const runtime = resolveProviderMenuRuntimeProfile({
    providerId: PROVIDER_ID,
    country: countryMap[menuLocale],
    menuLocale,
    menuProfileId: profileMap[menuLocale],
  });

  return generateProviderWeekMenu({
    providerId: PROVIDER_ID,
    weekStart: WEEK_START,
    menuLocale,
    country: countryMap[menuLocale],
    menuProfileId: profileMap[menuLocale],
    packageTier: tier,
    enabledCategories: runtime.enabledCategories,
    economyConfig: runtime.economyConfig,
  });
}

describe("localized fixed menu generator — locale banks", () => {
  test("nb-NO bank has Norwegian dishes", () => {
    const bank = getFixedDishBankForLocale("nb-NO");
    expect(bank.some((d) => d.title.includes("Kjøttkaker"))).toBe(true);
    expect(bank.filter((d) => d.categoryKey === "sandwich").length).toBeGreaterThanOrEqual(8);
  });

  test("sv-SE bank has Swedish dishes", () => {
    const bank = getFixedDishBankForLocale("sv-SE");
    expect(bank.some((d) => d.title.includes("Köttbullar"))).toBe(true);
  });

  test("da-DK bank has Danish dishes", () => {
    const bank = getFixedDishBankForLocale("da-DK");
    expect(bank.some((d) => d.title.includes("Frikadeller"))).toBe(true);
  });

  test("en-GB bank has UK dishes", () => {
    const bank = getFixedDishBankForLocale("en-GB");
    expect(bank.some((d) => d.title.toLowerCase().includes("cottage pie"))).toBe(true);
  });
});

describe("localized fixed menu generator — determinism and locale separation", () => {
  test("same input gives same output", () => {
    const a = generateForLocale("nb-NO");
    const b = generateForLocale("nb-NO");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  test("different locales give different menus", () => {
    const no = generateForLocale("nb-NO");
    const se = generateForLocale("sv-SE");
    const noTitles = no.days.flatMap((d) => d.choices.map((c) => c.title)).join("|");
    const seTitles = se.days.flatMap((d) => d.choices.map((c) => c.title)).join("|");
    expect(noTitles).not.toBe(seTitles);
  });

  test("employee locale does not override provider menuLocale", () => {
    const withEmployeeEn = resolveProviderMenuRuntimeProfile({
      providerId: PROVIDER_ID,
      country: "NO",
      menuLocale: "nb-NO",
      menuProfileId: "norwegian_company_lunch",
      employeeLocale: "en-GB",
    });
    const withoutEmployee = resolveProviderMenuRuntimeProfile({
      providerId: PROVIDER_ID,
      country: "NO",
      menuLocale: "nb-NO",
      menuProfileId: "norwegian_company_lunch",
    });
    expect(withEmployeeEn.menuLocale).toBe("nb-NO");
    expect(withEmployeeEn.fixedDishBank).toEqual(withoutEmployee.fixedDishBank);
  });
});

describe("localized fixed menu generator — tier rules", () => {
  test("BASIS includes sandwich salad hotMeal only", () => {
    const cats = categoriesForTier("BASIS", "nb-NO");
    expect(cats).toEqual(["sandwich", "salad", "hotMeal"]);
  });

  test("LUXUS adds asian categories when locale allows", () => {
    const cats = categoriesForTier("LUXUS", "sv-SE");
    expect(cats).toContain("sushi");
    expect(cats).toContain("poke");
  });

  test("ENTERPRISE adds premiumUpgrade", () => {
    const cats = categoriesForTier("ENTERPRISE", "nb-NO");
    expect(cats).toContain("premiumUpgrade");
  });

  test("enterprise upgrade keeps same hotMeal identity", () => {
    const menu = generateForLocale("nb-NO", "ENTERPRISE");
    for (const day of menu.days) {
      const hot = day.choices.find((c) => c.categoryKey === "hotMeal");
      const upgrade = day.choices.find((c) => c.categoryKey === "premiumUpgrade");
      if (!hot || !upgrade) continue;
      expect(upgrade.hotMealBaseItemKey).toBe(hot.itemKey);
      expect(upgrade.isPremiumUpgrade).toBe(true);
    }
  });
});

describe("localized fixed menu generator — employee vs provider output", () => {
  test("employee output contains allergens", () => {
    const menu = generateForLocale("nb-NO");
    const safe = mapGeneratedWeekMenuToEmployeeSafe(menu);
    const withAllergens = safe.days.flatMap((d) => d.choices).filter((c) => c.allergens.length > 0);
    expect(withAllergens.length).toBeGreaterThan(0);
  });

  test("employee output excludes economy fields", () => {
    const menu = generateForLocale("nb-NO");
    const safe = mapGeneratedWeekMenuToEmployeeSafe(menu);
    assertEmployeeSafePayload(safe);
    const json = JSON.stringify(safe);
    for (const field of [...EMPLOYEE_COMMERCIAL_FIELD_NAMES, "currency", "vat", "mva", "cost", "margin"]) {
      expect(json).not.toContain(`"${field}"`);
    }
  });

  test("provider output includes economy", () => {
    const runtime = resolveProviderMenuRuntimeProfile({
      providerId: PROVIDER_ID,
      country: "NO",
      menuLocale: "nb-NO",
      menuProfileId: "norwegian_company_lunch",
    });
    const menu = generateForLocale("nb-NO");
    const admin = mapGeneratedWeekMenuToProviderAdmin(menu, runtime);
    expect(admin.profile.economySummary.currency).toBeTruthy();
    expect(admin.days[0]?.choices[0]?.economy?.providerCost).toBeGreaterThan(0);
  });
});

describe("localized fixed menu generator — stable keys", () => {
  test("itemKey stable across generations", () => {
    const key = buildStableItemKey("nb-NO", "sandwich", "grovt-rundstykke-ost-skinke");
    expect(key).toBe("nb-NO:sandwich:grovt-rundstykke-ost-skinke");
  });

  test("choiceKey stable for same provider week day tier item", () => {
    const itemKey = buildStableItemKey("sv-SE", "hotMeal", "kottbullar-lingon");
    const choiceKey = buildStableChoiceKey({
      providerId: PROVIDER_ID,
      weekStart: WEEK_START,
      dayIndex: 0,
      tier: "LUXUS",
      itemKey,
    });
    expect(choiceKey).toContain(PROVIDER_ID);
    expect(choiceKey).toContain(itemKey);
  });
});

describe("localized fixed menu generator — safety boundaries", () => {
  const ROOT = process.cwd();

  test("generator does not import order write-path or lp_order_set", () => {
    const files = [
      "lib/menu-generator/generateProviderWeekMenu.ts",
      "lib/menu-generator/resolveProviderMenuRuntimeProfile.ts",
      "app/api/provider/menu-generator/week-preview/route.ts",
    ];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
      expect(src).not.toMatch(/lp_order_set/);
      expect(src).not.toMatch(/resolveOrderDayItemPersist/);
      expect(src).not.toMatch(/orderWriteGuard/);
    }
  });

  test("economy config per country defaults", () => {
    expect(resolveEconomyConfigForCountry("NO").currency).toBe(`${"NO"}K`);
    expect(resolveEconomyConfigForCountry("SE").currency).toBe("SEK");
    expect(resolveEconomyConfigForCountry("GB").currency).toBe("GBP");
  });
});

describe("localized fixed menu generator — examples", () => {
  test("nb-NO generated menu sample", () => {
    const menu = generateForLocale("nb-NO");
    expect(menu.days).toHaveLength(5);
    expect(menu.days[0]?.choices.some((c) => c.title.includes("Kjøttkaker") || c.categoryKey === "sandwich")).toBe(true);
  });

  test("sv-SE generated menu sample", () => {
    const menu = generateForLocale("sv-SE");
    const titles = menu.days.flatMap((d) => d.choices.map((c) => c.title)).join(" ");
    expect(titles).toMatch(/Köttbullar|Smörgås|Kyckling/i);
  });

  test("da-DK generated menu sample", () => {
    const menu = generateForLocale("da-DK");
    const titles = menu.days.flatMap((d) => d.choices.map((c) => c.title)).join(" ");
    expect(titles).toMatch(/Frikadeller|Smørrebrød/i);
  });

  test("en-GB generated menu sample", () => {
    const menu = generateForLocale("en-GB");
    const titles = menu.days.flatMap((d) => d.choices.map((c) => c.title)).join(" ");
    expect(titles).toMatch(/sandwich|Cottage|Chicken/i);
  });
});

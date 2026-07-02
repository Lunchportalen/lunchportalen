/**
 * PR C — display-only employee /week label fallback (never menu/order identity).
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { buildOrderWriteBody } from "@/app/(app)/week/EmployeeWeekClient";
import { buildMenuDayCategories } from "@/app/api/order/window/route";
import { ORDER_CHOICE_KEY_BY_CATEGORY } from "@/lib/cms/menuDayContract";
import {
  createEmployeeWeekDisplayLabels,
  type EmployeeWeekCategoryInput,
} from "@/lib/i18n/employeeWeekDisplayLabels";

const ROOT = process.cwd();

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("employee week display i18n fallback", () => {
  test("category labels can differ by locale while choice keys stay stable", () => {
    const nb = createEmployeeWeekDisplayLabels("nb");
    const en = createEmployeeWeekDisplayLabels("en");
    const input: EmployeeWeekCategoryInput = {
      category: "varmrett",
      key: "varmmat",
      apiLabel: "Varmrett",
    };

    expect(nb.categoryLabel(input)).toBe("Varmmat");
    expect(en.categoryLabel(input)).toBe("Hot meal");
    expect(ORDER_CHOICE_KEY_BY_CATEGORY.varmrett).toBe("varmmat");
  });

  test("allergen labels can differ by locale while slug identity is preserved", () => {
    const en = createEmployeeWeekDisplayLabels("en");
    expect(en.allergenLabel("melk")).toBe("Milk");
    expect(en.allergenLabel("gluten")).toBe("Gluten");
    expect(en.allergenLabel("unknown-allergen-slug")).toBe("unknown-allergen-slug");
  });

  test("provider meal title/description are not auto-translated by display helper", () => {
    const en = createEmployeeWeekDisplayLabels("en");
    const providerTitle = "Kyllinggryte med rotgrønnsaker";
    expect(en.categoryLabel({ category: "varmrett", key: "varmmat", apiLabel: "Varmrett" })).not.toBe(
      providerTitle,
    );
    expect(providerTitle).toBe("Kyllinggryte med rotgrønnsaker");
  });

  test("missing locale label falls back to Norwegian then API label then key", () => {
    const en = createEmployeeWeekDisplayLabels("en");
    expect(
      en.categoryLabel({ category: null, key: "custom-slot", apiLabel: "Egendefinert kategori" }),
    ).toBe("Egendefinert kategori");
    expect(en.categoryLabel({ category: null, key: "custom-slot", apiLabel: "" })).toBe("custom-slot");
  });

  test("order write path still uses choice_key and item_key only", () => {
    const body = buildOrderWriteBody("2026-06-02", true, "salatboks", "kylling");
    expect(body).toEqual({
      date: "2026-06-02",
      action: "set",
      choice_key: "salatboks",
      itemKey: "kylling",
    });
  });

  test("menu identity from buildMenuDayCategories is unchanged across display locales", () => {
    const menus = [
      {
        category: "varmrett" as const,
        mealTitle: "Kyllinggryte",
        description: "Med rotgrønnsaker",
        allergens: ["melk"],
      },
    ];
    const baseline = buildMenuDayCategories({ planTier: "BASIS", menus });
    for (const locale of ["nb", "en", "sv", "da"] as const) {
      createEmployeeWeekDisplayLabels(locale);
      expect(buildMenuDayCategories({ planTier: "BASIS", menus })).toEqual(baseline);
    }
  });

  test("employee week APIs still ignore UI locale", () => {
    for (const route of ["app/api/order/window/route.ts", "app/api/week/route.ts"]) {
      const src = readSource(route);
      expect(src).not.toMatch(/\blp_locale\b/);
      expect(src).not.toMatch(/\bresolveAppLocale\b/);
    }
  });

  test("EmployeeWeekClient uses display-only locale prop and does not query menu APIs by locale", () => {
    const src = readSource("app/(app)/week/EmployeeWeekClient.tsx");
    expect(src).toContain("displayLocale?: AppLocale");
    expect(src).toContain("createEmployeeWeekDisplayLabels");
    expect(src).not.toMatch(/fetch\([^)]*locale/i);
    expect(src).not.toMatch(/\/api\/order\/window\?.*locale/i);
  });

  test("employee header still hides LocaleSwitcher", () => {
    expect(readSource("components/nav/HeaderShell.tsx")).toContain('navVariantKey !== "employee"');
    expect(readSource("components/layout/EmployeeLayout.tsx")).toContain("showLocaleSwitcher={false}");
  });
});

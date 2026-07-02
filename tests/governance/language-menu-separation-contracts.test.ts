/**
 * PR A — governance/static guards: UI language separated from menu profile, currency, publish, order write.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { MARKET_COMMERCIAL_CONFIGS } from "@/lib/commercial/marketConfigs";
import { APP_LOCALES } from "@/lib/i18n/localeRegistry";
import { resolveAppLocale } from "@/lib/i18n/resolveAppLocale";
import {
  isMenuProfileCompatibilityCutoverEnabled,
  isMenuProfileFixedCategoriesPanelEnabled,
  isMenuProfileMappingDraftApiEnabled,
  isMenuProfileMappingDraftSaveUiEnabled,
  isMenuProfilePublishShadowEnabled,
  isMenuProfileResolverEnabled,
  isMenuProfileRuntimeCompatibilityHookEnabled,
  isMenuProfileRuntimeMappingProposalPanelEnabled,
  isMenuProfileWarmDishPreviewPanelEnabled,
  isMenuProfileWeekShadowReadEnabled,
  LP_MENU_PROFILE_RESOLVER_ENV,
} from "@/lib/menu-profile/featureFlag";
import { EMPLOYEE_COMMERCIAL_FIELD_NAMES } from "../fixtures/g5d0-runtime-contract.constants";

const ROOT = process.cwd();

/** Extended forbidden keys for employee read paths (PR A audit scope). */
const LANGUAGE_MENU_EMPLOYEE_FORBIDDEN_FIELDS = [
  ...EMPLOYEE_COMMERCIAL_FIELD_NAMES,
  "currency",
  "vat",
  "mva",
  "gross",
  "subtotal",
  "commercialVisibleChanges",
  "sourceOfTruthSwitch",
  "autoRollout",
  "runtimeHookActive",
  "candidateOrderable",
  "sourceOfTruthChanged",
] as const;

const MENU_IDENTITY_ROUTES = [
  "app/api/week/route.ts",
  "app/api/order/window/route.ts",
  "app/api/orders/route.ts",
] as const;

const LOCALE_INPUT_PATTERNS = [
  /\blp_locale\b/,
  /\bresolveAppLocale\b/,
  /\bloadMessagesForLocale\b/,
  /\bprofiles\.preferred_locale\b/,
  /\bAccept-Language\b/,
  /\bsearchParams\.get\(["']locale["']\)/,
  /\bsearchParams\.get\(["']lang["']\)/,
];

function readSource(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assertSourceFreeOfPatterns(relPath: string, patterns: RegExp[], label: string) {
  const src = readSource(relPath);
  for (const pattern of patterns) {
    expect(src, `${label}: ${relPath} must not reference ${pattern}`).not.toMatch(pattern);
  }
}

describe("language-menu separation — employee menu APIs ignore UI locale", () => {
  for (const route of MENU_IDENTITY_ROUTES) {
    test(`${route} does not read UI locale for menu identity`, () => {
      assertSourceFreeOfPatterns(route, LOCALE_INPUT_PATTERNS, "menu identity route");
    });
  }

  test("i18n request config does not import menu/week/order runtime", () => {
    const src = readSource("i18n/request.ts");
    expect(src).not.toMatch(/@\/app\/api\/week/);
    expect(src).not.toMatch(/@\/app\/api\/order\/window/);
    expect(src).not.toMatch(/@\/lib\/cms\/menuDay/);
    expect(src).not.toMatch(/buildMenuDayCategories/);
  });

  test("resolveAppLocale module does not import menu or commercial runtime", () => {
    const src = readSource("lib/i18n/resolveAppLocale.ts");
    expect(src).not.toMatch(/menuDay|menu-profile|providerMenuScope|tierPricing/);
  });
});

describe("language-menu separation — currency decoupled from UI locale", () => {
  test("marketConfigs documents UI locale unrelated to commercial config", () => {
    const src = readSource("lib/commercial/marketConfigs.ts");
    expect(src).toMatch(/UI locale.*unrelated/i);
    expect(src).toMatch(/NOT FOR RUNTIME/);
  });

  test("defaultUiLocale on market config is hint only — not derived from resolveAppLocale", () => {
    for (const config of Object.values(MARKET_COMMERCIAL_CONFIGS)) {
      expect(config.defaultCurrency).toBeTruthy();
      expect(typeof config.defaultUiLocale).toBe("string");
    }
    expect(resolveAppLocale({ cookie: "en" })).toBe("en");
    expect(MARKET_COMMERCIAL_CONFIGS.NO.defaultCurrency).toBe("NOK");
    expect(MARKET_COMMERCIAL_CONFIGS.SE.defaultCurrency).toBe("SEK");
  });

  test("APP_LOCALES do not map 1:1 to currency codes (no locale→currency shortcut)", () => {
    for (const locale of APP_LOCALES) {
      expect(["NOK", "SEK", "DKK", "EUR", "GBP"]).not.toContain(locale);
    }
  });
});

describe("language-menu separation — provider publish unaffected by UI locale", () => {
  test("menuDayPayload has no locale field or lp_locale reference", () => {
    const src = readSource("lib/provider-menu/menuDayPayload.ts");
    expect(src).not.toMatch(/\blocale\b/);
    expect(src).not.toMatch(/\blp_locale\b/);
    expect(src).not.toMatch(/resolveAppLocale/);
    expect(src).not.toMatch(/loadMessagesForLocale/);
  });

  test("varmrett shared write uses buildMenuDayPayload without locale", () => {
    const src = readSource("lib/provider-menu/varmrettSharedWrite.ts");
    expect(src).toContain("buildMenuDayPayload");
    expect(src).not.toMatch(/\blocale\b/);
    expect(src).not.toMatch(/resolveAppLocale/);
  });

  test("menu publish sync does not import i18n locale resolution", () => {
    const src = readSource("lib/menu-publish/syncMenuServiceDayItems.ts");
    expect(src).not.toMatch(/resolveAppLocale|lp_locale|loadMessagesForLocale/);
  });
});

describe("language-menu separation — order write path", () => {
  test("resolveOrderDayItemPersist uses server menu item key — not client display title", () => {
    const src = readSource("lib/orders/resolveOrderDayItemPersist.ts");
    expect(src).toMatch(/Client `itemTitle` brukes ikke/);
    expect(src).toMatch(/item_key/);
    expect(src).not.toMatch(/clientItemTitle|itemTitle.*client/i);
  });

  test("orderWriteGuard blocks employee pricing/tier/currency overrides", () => {
    const src = readSource("lib/orders/orderWriteGuard.ts");
    expect(src).toContain('"currency"');
    expect(src).toContain('"tier"');
    expect(src).toContain('"price"');
    expect(src).not.toMatch(/resolveAppLocale/);
  });

  test("orderWriteBodySchema has no first-class locale/language field", () => {
    const src = readSource("lib/validation/schemas.ts");
    const start = src.indexOf("export const orderWriteBodySchema");
    const end = src.indexOf("export type OrderWriteBodyInput");
    const schemaBlock = src.slice(start, end);
    expect(schemaBlock).not.toMatch(/\blocale:\s*z\./);
    expect(schemaBlock).not.toMatch(/\blanguage:\s*z\./);
    expect(schemaBlock).toContain("choice_key");
    expect(schemaBlock).toContain("itemKey");
  });
});

describe("language-menu separation — missing translation fallback contract (static)", () => {
  test("menuDayContract category slugs are stable — labels are display-only Norwegian today", () => {
    const src = readSource("lib/cms/menuDayContract.ts");
    expect(src).toContain('paasmurt: "Påsmurt"');
    expect(src).toContain('varmrett: "Varmrett"');
    expect(src).toMatch(/ORDER_CHOICE_KEY_BY_CATEGORY/);
    expect(src).not.toMatch(/resolveAppLocale|lp_locale/);
  });

  test("employee week builder uses menu content as stored — no translation hook", () => {
    const src = readSource("lib/week/employeeWeekMenuDays.ts");
    expect(src).not.toMatch(/useTranslations|loadMessagesForLocale|resolveAppLocale/);
    expect(src).toContain("mealTitle");
  });
});

describe("language-menu separation — employee forbidden commercial/runtime fields", () => {
  test("order/window DayCategory types exclude extended forbidden employee fields", () => {
    const src = readSource("app/api/order/window/route.ts");
    const typeBlock = src.slice(src.indexOf("type DayCategoryItem"), src.indexOf("type AgreementStatusOut"));
    for (const field of LANGUAGE_MENU_EMPLOYEE_FORBIDDEN_FIELDS) {
      expect(typeBlock, `DayCategory* must not expose ${field}`).not.toMatch(
        new RegExp(`\\b${field}\\b\\s*:`),
      );
    }
  });

  test("employee week client documents no employer prices in window channel", () => {
    const src = readSource("app/(app)/week/EmployeeWeekClient.tsx");
    expect(src).toMatch(/Ingen employer-priser|ingen employer-priser/i);
    expect(src).toMatch(/unit_price/);
  });

  test("week route agreement payload builder excludes commercial fields", () => {
    const src = readSource("app/api/week/route.ts");
    for (const field of ["currency", "pricePreview", "commission", "provisjon", "vat", "mva"]) {
      expect(src).not.toMatch(new RegExp(`\\b${field}\\s*:`));
    }
  });
});

describe("language-menu separation — employee week language UX (PR B)", () => {
  test("employee HeaderShell does not expose active LocaleSwitcher", () => {
    const headerShell = readSource("components/nav/HeaderShell.tsx");
    expect(headerShell).toContain('navVariantKey !== "employee"');
    const headerView = readSource("components/nav/HeaderShellView.tsx");
    expect(headerView).toMatch(/showLocaleSwitcher\s*\?\s*<LocaleSwitcher/);
  });

  test("employee week client does not promise translated menu content", () => {
    const src = readSource("app/(app)/week/EmployeeWeekClient.tsx");
    expect(src).toContain("originalLanguageNotice");
    expect(src).toContain("originalMealNotice");
    expect(src).not.toMatch(/oversatt meny|translated menu/i);
  });
});

describe("language-menu separation — feature flag safety", () => {
  const EMPTY_ENV = {};

  test("all LP_MENU_PROFILE_* helpers default OFF with empty env", () => {
    expect(isMenuProfileResolverEnabled(EMPTY_ENV)).toBe(false);
    expect(isMenuProfileFixedCategoriesPanelEnabled(EMPTY_ENV)).toBe(false);
    expect(isMenuProfileWarmDishPreviewPanelEnabled(EMPTY_ENV)).toBe(false);
    expect(isMenuProfileRuntimeMappingProposalPanelEnabled(EMPTY_ENV)).toBe(false);
    expect(isMenuProfileMappingDraftApiEnabled(EMPTY_ENV)).toBe(false);
    expect(isMenuProfileMappingDraftSaveUiEnabled(EMPTY_ENV)).toBe(false);
    expect(isMenuProfilePublishShadowEnabled(EMPTY_ENV)).toBe(false);
    expect(isMenuProfileWeekShadowReadEnabled(EMPTY_ENV)).toBe(false);
    expect(isMenuProfileCompatibilityCutoverEnabled(EMPTY_ENV)).toBe(false);
    expect(isMenuProfileRuntimeCompatibilityHookEnabled(EMPTY_ENV)).toBe(false);
  });

  test("proposed employee profile runtime helper is not implemented in featureFlag.ts", () => {
    const src = readSource("lib/menu-profile/featureFlag.ts");
    expect(src).not.toMatch(/isMenuProfileEmployeeProfileRuntime/);
  });

  test("runtime compatibility hook defaults OFF — G5d.8 not assumed", () => {
    expect(isMenuProfileRuntimeCompatibilityHookEnabled({})).toBe(false);
    const hookSrc = readSource("lib/menu-profile/weekRuntimeCompatibilityHook.server.ts");
    expect(hookSrc).toMatch(/candidateOrderable:\s*false|candidateOrderable:\s*false/);
    expect(hookSrc).toMatch(/sourceOfTruthChanged:\s*false|sourceOfTruthChanged:\s*false/);
    const designDoc = readSource("docs/engineering/G5d7-compatibility-cutover-design-plan.md");
    expect(designDoc).toMatch(/G5d\.8/);
    expect(designDoc).toMatch(/not started|Not started/i);
  });

  test("week route wires hook module — flag checked inside hook, default OFF", () => {
    const weekSrc = readSource("app/api/week/route.ts");
    expect(weekSrc).toContain("maybeRunWeekRuntimeCompatibilityHook");
    const hookSrc = readSource("lib/menu-profile/weekRuntimeCompatibilityHook.server.ts");
    expect(hookSrc).toContain("isMenuProfileRuntimeCompatibilityHookEnabled");
    expect(hookSrc).toMatch(/runtimeHookActive:\s*false/);
    expect(hookSrc).toMatch(/sourceOfTruthChanged:\s*false/);
    expect(hookSrc).toMatch(/candidateOrderable:\s*false/);
    expect(isMenuProfileRuntimeCompatibilityHookEnabled({})).toBe(false);
  });

  test("menu profile resolver OFF by default — presentation not runtime source of truth", () => {
    expect(isMenuProfileResolverEnabled({})).toBe(false);
    expect(isMenuProfileResolverEnabled({ [LP_MENU_PROFILE_RESOLVER_ENV]: "true" })).toBe(true);
    const presentationSrc = readSource("lib/provider-menu/providerMenuProfilePresentation.ts");
    expect(presentationSrc).toContain("return { active: false }");
  });
});

describe("language-menu separation — PR C employee display fallback", () => {
  test("employee display labels live in client helper, not menu APIs", () => {
    expect(fs.existsSync(path.join(ROOT, "lib/i18n/employeeWeekDisplayLabels.ts"))).toBe(true);
    for (const route of ["app/api/order/window/route.ts", "app/api/week/route.ts"]) {
      const src = readSource(route);
      expect(src).not.toContain("employeeWeekDisplayLabels");
    }
  });

  test("EmployeeWeekClient passes displayLocale without changing order write body", () => {
    const src = readSource("app/(app)/week/EmployeeWeekClient.tsx");
    expect(src).toContain("displayLocale?: AppLocale");
    expect(src).toContain("choice_key");
    expect(src).not.toMatch(/choice_key:\s*display\.categoryLabel/);
  });
});

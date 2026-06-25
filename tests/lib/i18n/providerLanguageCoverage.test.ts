import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_LOCALES, getLocaleLabel } from "@/lib/i18n/localeRegistry";
import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  PROVIDER_LOCALE_OPTIONS,
  PROVIDER_LOCALE_VALUES,
} from "@/lib/providers/operationalSettingsShared";

const MESSAGE_LOCALES = ["nb", "en", "sv", "da", "fi", "de", "fr", "es", "it"] as const;

/** Distinctly Norwegian UI strings — excludes shared Scandinavian homographs (e.g. Faktura, Meny). */
const NORWEGIAN_LEAKAGE = [
  "Lagre",
  "Velg språk",
  "Ukjent",
  "Leverandør",
  "Innstillinger",
  "Ordre",
  "MVA",
  "oppgjør",
  "provisjon",
  "Leveringsadresse ikke satt",
  "Retten",
  "Ikke innlogget",
  "Ingen tilgang",
  "Kun provider-admin",
];

const MENU_PROFILE_PATHS = [
  "provider.settings.menuProfile.heading",
  "provider.settings.menuProfile.flagActive",
  "provider.settings.menuProfile.statusInactive",
  "provider.settings.menuProfile.statusLabel",
  "provider.settings.menuProfile.uiVsProfileExplanation",
  "provider.settings.menuProfile.profileLabel",
  "provider.settings.menuProfile.sourceLabel",
  "provider.settings.menuProfile.marketLabel",
  "provider.settings.menuProfile.localeLabel",
  "provider.settings.menuProfile.currencyLabel",
  "provider.settings.menuProfile.readOnlyNote",
  "provider.settings.menuProfile.invalidProfile",
  "provider.settings.menuProfile.sourceProviderSetting",
  "provider.settings.menuProfile.sourceMarketDefault",
  "provider.settings.menuProfile.sourceFallbackNoMarket",
  "provider.settings.menuProfile.sourceLegacyDisabled",
  "provider.settings.menuProfile.sourceUnknown",
  "provider.settings.menuProfile.marketNames.NO",
  "provider.settings.menuProfile.marketNames.IT",
  "provider.menu.workspaceProfile.badge",
  "provider.menu.workspaceProfile.banner",
  "provider.menu.workspaceProfile.metaLine",
  "provider.menu.workspaceFixedCategories.title",
  "provider.menu.workspaceFixedCategories.description",
  "provider.menu.workspaceFixedCategories.activeInCurrentCatalog",
  "provider.menu.workspaceFixedCategories.comingStructureNotOrderActive",
  "provider.menu.workspaceFixedCategories.orderRuntimeEnabled",
  "provider.menu.workspaceFixedCategories.presentationOnly",
  "provider.menu.workspaceFixedCategories.packagesLabel",
  "provider.menu.workspaceFixedCategories.profileCategoryLabel",
  "provider.menu.workspaceWarmDishPreview.title",
  "provider.menu.workspaceWarmDishPreview.description",
  "provider.menu.workspaceWarmDishPreview.previewOnly",
  "provider.menu.workspaceWarmDishPreview.notPublished",
  "provider.menu.workspaceWarmDishPreview.notVisibleToEmployees",
  "provider.menu.workspaceWarmDishPreview.suggestedForProfile",
  "provider.menu.workspaceWarmDishPreview.suggestedTiers",
  "provider.menu.workspaceWarmDishPreview.allergensLabel",
  "provider.menu.workspaceWarmDishPreview.tagsLabel",
  "provider.menu.workspaceWarmDishPreview.weekdayLabel",
  "provider.menu.workspaceWarmDishPreview.noItems",
  "provider.menu.workspaceWarmDishPreview.profileMeta",
  "provider.menu.workspaceWarmDishPreview.notPublishedHelp",
  "provider.menu.workspaceWarmDishPreview.weekdays.monday",
  "provider.menu.workspaceWarmDishPreview.weekdays.friday",
] as const;

function collectLeafPaths(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return prefix ? [prefix] : [];
  if (!node || typeof node !== "object") return [];
  const out: string[] = [];
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(...collectLeafPaths(value, path));
  }
  return out;
}

function getAtPath(node: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, node);
}

function extractPlaceholders(value: string): string[] {
  return (value.match(/\{[a-zA-Z0-9_,]+\}/g) ?? []).sort();
}

describe("provider language coverage (pre-merge PR #343)", () => {
  it("APP_LOCALES contains all 9 supported app languages in stable order", () => {
    expect(APP_LOCALES).toEqual(["nb", "da", "de", "en", "es", "fr", "it", "fi", "sv"]);
    expect(getLocaleLabel("it")).toBe("Italiano");
  });

  it("PROVIDER_LOCALE_OPTIONS follows APP_LOCALES order", () => {
    expect(PROVIDER_LOCALE_VALUES).toEqual([
      "nb-NO",
      "da-DK",
      "de-DE",
      "en-GB",
      "es-ES",
      "fr-FR",
      "it-IT",
      "fi-FI",
      "sv-SE",
    ]);
    expect(PROVIDER_LOCALE_OPTIONS).toHaveLength(9);
  });

  it("operational language label clarifies separate menu/currency control (nb)", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { settings: { operations: { localeLabel: string; localeHint: string } } };
    };
    expect(messages.provider.settings.operations.localeLabel).toBe("Administrasjonsspråk");
    expect(messages.provider.settings.operations.localeLabel).not.toBe("Språk");
    expect(messages.provider.settings.operations.localeHint).toMatch(/menyprofil/i);
    expect(messages.provider.settings.operations.localeHint).toMatch(/valuta/i);
  });

  it("LocaleSwitcher iterates APP_LOCALES in registry order", () => {
    const src = readFileSync(join(process.cwd(), "components/nav/LocaleSwitcher.tsx"), "utf8");
    expect(src).toContain("APP_LOCALES.map");
  });

  it("ProviderOperationsForm maps every PROVIDER_LOCALE_OPTIONS value to i18n label keys", () => {
    const src = readFileSync(join(process.cwd(), "components/providers/ProviderOperationsForm.tsx"), "utf8");
    expect(src).toContain("PROVIDER_LOCALE_OPTIONS.map");
    expect(src).toContain('t(`locales.${o.value}`)');
  });

  it("menu profile diagnostic explains UI vs menu/currency separation", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { settings: { menuProfile: { uiVsProfileExplanation: string; statusInactive: string } } };
    };
    expect(messages.provider.settings.menuProfile.uiVsProfileExplanation).toMatch(/UI-språk/i);
    expect(messages.provider.settings.menuProfile.uiVsProfileExplanation).toMatch(/valuta/i);
    expect(messages.provider.settings.menuProfile.statusInactive).toMatch(/Menyprofil/i);
  });

  it("profiles.preferred_locale migration includes all 9 app locales", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20260726120000_profiles_preferred_locale_nine_locales.sql"),
      "utf8",
    );
    for (const locale of APP_LOCALES) {
      expect(sql).toContain(`'${locale}'`);
    }
  });

  it.each(MESSAGE_LOCALES)("messages/%s.json has provider.* file parity with nb", async (locale) => {
    const nb = JSON.parse(readFileSync(join(process.cwd(), "messages/nb.json"), "utf8")) as Record<string, unknown>;
    const file = JSON.parse(readFileSync(join(process.cwd(), `messages/${locale}.json`), "utf8")) as Record<
      string,
      unknown
    >;
    const nbPaths = collectLeafPaths(nb.provider).map((p) => `provider.${p}`);
    const filePaths = collectLeafPaths(file.provider).map((p) => `provider.${p}`);
    for (const path of nbPaths) {
      expect(filePaths, `${locale} missing ${path}`).toContain(path);
    }
  });

  it.each(MESSAGE_LOCALES.filter((l) => l !== "nb"))(
    "loadMessagesForLocale(%s) provider.* placeholder parity with nb",
    async (locale) => {
      const nb = (await loadMessagesForLocale("nb")) as Record<string, unknown>;
      const messages = (await loadMessagesForLocale(locale)) as Record<string, unknown>;
      const nbPaths = collectLeafPaths(nb.provider).map((p) => `provider.${p}`);
      for (const path of nbPaths) {
        const nbVal = String(getAtPath(nb, path));
        const locVal = String(getAtPath(messages, path));
        expect(extractPlaceholders(locVal)).toEqual(extractPlaceholders(nbVal));
      }
    },
  );

  it.each(["en", "de", "fr", "es", "it", "fi"] as const)(
    "loadMessagesForLocale(%s) has no critical Norwegian leakage in provider chrome",
    async (locale) => {
      const messages = (await loadMessagesForLocale(locale)) as Record<string, unknown>;
      const paths = collectLeafPaths(messages.provider).map((p) => `provider.${p}`);
      for (const path of paths) {
        const value = String(getAtPath(messages, path));
        for (const forbidden of NORWEGIAN_LEAKAGE) {
          expect(value, `${locale} ${path}`).not.toBe(forbidden);
        }
      }
    },
  );

  it.each(MESSAGE_LOCALES)("menuProfile diagnostic keys exist in messages/%s.json", async (locale) => {
    const messages = (await loadMessagesForLocale(locale)) as Record<string, unknown>;
    for (const path of MENU_PROFILE_PATHS) {
      const value = getAtPath(messages, path);
      expect(typeof value).toBe("string");
      expect(String(value).length).toBeGreaterThan(0);
    }
  });

  it.each(MESSAGE_LOCALES)(
    "provider.settings.operations.locales has all 9 entries in messages/%s.json merge",
    async (locale) => {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { settings: { operations: { locales: Record<string, string> } } };
      };
      for (const code of PROVIDER_LOCALE_VALUES) {
        expect(messages.provider.settings.operations.locales[code]).toBeTruthy();
      }
    },
  );

  it("Tripletex accountingIntro is Norwegian-integration-specific for non-NO UI locales", async () => {
    for (const locale of ["en", "sv", "da", "fi", "de", "fr", "es", "it"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { settings: { page: { accountingIntro: string } } };
      };
      const intro = messages.provider.settings.page.accountingIntro;
      expect(intro.toLowerCase()).toMatch(
        /norw|norve|norj|norweg|noruego|norvég|norja|norvegese|norsk|norwegian|norueg/,
      );
      expect(intro).not.toMatch(/global accounting standard for (italy|germany|france|spain)/i);
    }
  });

  it("employee/week menu messages remain price-free in Italian merge", async () => {
    const itMessages = (await loadMessagesForLocale("it")) as { provider: { menu: unknown } };
    const menuJson = JSON.stringify(itMessages.provider.menu);
    expect(menuJson).not.toMatch(/NOK|provisjon|fakturering til ansatte/i);
  });
});

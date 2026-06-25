import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import { resolveAppLocale } from "@/lib/i18n/resolveAppLocale";

const NAV_LABEL_CASES = [
  { locale: "nb", orders: "Ordrer", roleKitchen: "Kjøkken" },
  { locale: "en", orders: "Orders", roleKitchen: "Kitchen" },
  { locale: "sv", orders: "Ordrar", roleKitchen: "Kök" },
  { locale: "da", orders: "Ordrer", roleKitchen: "Køkken" },
  { locale: "fi", orders: "Tilaukset", roleKitchen: "Keittiö" },
  { locale: "de", orders: "Bestellungen", roleKitchen: "Küche" },
  { locale: "fr", orders: "Commandes", roleKitchen: "Cuisine" },
  { locale: "es", orders: "Pedidos", roleKitchen: "Cocina" },
  { locale: "it", orders: "Ordini", roleKitchen: "Cucina" },
] as const;

describe("provider shell UI locale", () => {
  it("resolveAppLocale treats lp_locale cookie as UI locale source of truth", () => {
    expect(resolveAppLocale({ cookie: "de", profile: "nb" })).toBe("de");
    expect(resolveAppLocale({ cookie: "it", profile: "en" })).toBe("it");
  });

  it("i18n request config reads cookie before profile fallback", () => {
    const source = readFileSync(join(process.cwd(), "i18n/request.ts"), "utf8");
    expect(source).toContain("LP_LOCALE_COOKIE");
    expect(source).toContain("resolveAppLocale");
    expect(source).toContain("loadProfilePreferredLocaleForRequest");
  });

  it("root layout remounts NextIntlClientProvider when locale changes", () => {
    const source = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(source).toContain("<NextIntlClientProvider key={locale}");
  });

  it("provider layout renders ProviderNav shell (not hardcoded nav)", () => {
    const source = readFileSync(join(process.cwd(), "app/leverandor/layout.tsx"), "utf8");
    expect(source).toContain("<ProviderNav");
    expect(source).not.toMatch(/>\s*Ordrer\s*</);
  });

  it("ProviderNav wires LocaleSwitcher in shell for all provider pages", () => {
    const source = readFileSync(join(process.cwd(), "components/providers/ProviderNav.tsx"), "utf8");
    expect(source).toContain('useTranslations("provider.nav")');
    expect(source).toContain("<LocaleSwitcher");
    expect(source).toContain("persistProfile");
  });

  it("operational provider locale remains separate from app UI locale", () => {
    const shared = readFileSync(join(process.cwd(), "lib/providers/operationalSettingsShared.ts"), "utf8");
    expect(shared).toContain("provider_settings.locale er foreløpig inert i runtime");
    const market = readFileSync(join(process.cwd(), "lib/commercial/marketConfigs.ts"), "utf8");
    expect(market).toContain("UI locale");
  });

  it.each(NAV_LABEL_CASES)(
    "provider.nav labels for $locale are non-Norwegian when locale is not nb",
    async ({ locale, orders, roleKitchen }) => {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { nav: { orders: string; roleKitchen: string } };
      };
      expect(messages.provider.nav.orders).toBe(orders);
      expect(messages.provider.nav.roleKitchen).toBe(roleKitchen);
      if (locale !== "nb" && locale !== "da") {
        expect(messages.provider.nav.orders).not.toBe("Ordrer");
      }
      if (!["nb", "sv"].includes(locale)) {
        expect(messages.provider.nav.roleKitchen).not.toBe("Kjøkken");
      }
    },
  );
});

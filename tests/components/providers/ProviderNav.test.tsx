import { describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { NextIntlClientProvider } from "next-intl";

import { loadMessagesForLocale } from "@/lib/i18n/messages";

vi.mock("next/navigation", () => ({
  usePathname: () => "/leverandor/ordrer",
}));

vi.mock("@/components/auth/LogoutClient", () => ({
  LogoutClientButton: ({ className, ...props }: { className?: string }) => (
    <button type="button" className={className} {...props}>
      Log out
    </button>
  ),
}));

vi.mock("@/components/nav/LocaleSwitcher", () => ({
  default: () => <div data-testid="locale-switcher" />,
}));

describe("ProviderNav aria-labels", () => {
  test("sidebar nav aria-label uses sidebarLabel translation key", async () => {
    const messages = await loadMessagesForLocale("en");
    const { default: ProviderNav } = await import("@/components/providers/ProviderNav");

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProviderNav
          providerName="Test Provider"
          logoUrl={null}
          userRole="provider_kitchen"
          kitchenOnly
        />
      </NextIntlClientProvider>,
    );

    expect(html).toContain('aria-label="Provider"');
    expect(html).toContain('aria-label="Provider (desktop)"');
    expect(html).toContain('aria-label="Main navigation (mobile)"');
  });

  test("all eight locales define nav aria-label keys", async () => {
    const locales = ["nb", "en", "sv", "da", "fi", "de", "fr", "es", "it"] as const;
    for (const locale of locales) {
      const messages = await loadMessagesForLocale(locale);
      const nav = (messages.provider as { nav: Record<string, string> }).nav;
      expect(nav.sidebarLabel, locale).toBeTruthy();
      expect(nav.desktopLabel, locale).toBeTruthy();
      expect(nav.mobileLabel, locale).toBeTruthy();
    }
  });

  test("source does not hardcode Norwegian nav aria-labels", () => {
    const source = readFileSync(resolve(process.cwd(), "components/providers/ProviderNav.tsx"), "utf8");
    expect(source).not.toMatch(/aria-label="Leverandør/);
    expect(source).not.toMatch(/aria-label="Hovednavigasjon/);
  });

  test.each([
    { locale: "de", orders: "Bestellungen", roleKitchen: "Küche" },
    { locale: "fr", orders: "Commandes", roleKitchen: "Cuisine" },
    { locale: "es", orders: "Pedidos", roleKitchen: "Cocina" },
    { locale: "it", orders: "Ordini", roleKitchen: "Cucina" },
    { locale: "fi", orders: "Tilaukset", roleKitchen: "Keittiö" },
  ] as const)("renders translated kitchen nav labels for $locale", async ({ locale, orders, roleKitchen }) => {
    const messages = await loadMessagesForLocale(locale);
    const { default: ProviderNav } = await import("@/components/providers/ProviderNav");

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ProviderNav
          providerName="Test Provider"
          logoUrl={null}
          userRole="provider_kitchen"
          kitchenOnly
        />
      </NextIntlClientProvider>,
    );

    expect(html).toContain(orders);
    expect(html).toContain(roleKitchen);
    expect(html).not.toContain(">Ordrer<");
    expect(html).not.toContain(">Kjøkken<");
  });

  test("provider shell includes locale switcher for kitchen-only members", async () => {
    const messages = await loadMessagesForLocale("en");
    const { default: ProviderNav } = await import("@/components/providers/ProviderNav");

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProviderNav
          providerName="Test Provider"
          logoUrl={null}
          userRole="provider_kitchen"
          kitchenOnly
        />
      </NextIntlClientProvider>,
    );

    expect(html).toContain('data-testid="locale-switcher"');
  });

  test("ProviderNav wires logout label through i18n keys", () => {
    const source = readFileSync(resolve(process.cwd(), "components/providers/ProviderNav.tsx"), "utf8");
    expect(source).toContain('t("logout")');
    expect(source).toContain('t("logoutPending")');
    expect(source).toContain("label={logoutLabel}");
    expect(source).toContain("pendingLabel={logoutPendingLabel}");
  });

  test.each([
    { locale: "nb", logout: "Logg ut" },
    { locale: "en", logout: "Log out" },
    { locale: "sv", logout: "Logga ut" },
    { locale: "da", logout: "Log ud" },
    { locale: "fi", logout: "Kirjaudu ulos" },
    { locale: "de", logout: "Abmelden" },
    { locale: "fr", logout: "Se déconnecter" },
    { locale: "es", logout: "Cerrar sesión" },
    { locale: "it", logout: "Esci" },
  ] as const)("provider.nav.logout for $locale", async ({ locale, logout }) => {
    const messages = await loadMessagesForLocale(locale);
    const nav = (messages.provider as { nav: Record<string, string> }).nav;
    expect(nav.logout).toBe(logout);
    expect(nav.logoutPending).toBeTruthy();
  });
});

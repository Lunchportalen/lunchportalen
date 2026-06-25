import { describe, expect, test, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { NextIntlClientProvider } from "next-intl";

import { loadMessagesForLocale } from "@/lib/i18n/messages";

vi.mock("next/navigation", () => ({
  usePathname: () => "/leverandor",
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

describe("LeverandorDashboardPage i18n", () => {
  test("dashboard page uses getTranslations for provider.dashboard", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/page.tsx"), "utf8");
    expect(source).toContain('getTranslations("provider.dashboard")');
    expect(source).not.toContain("LocaleSwitcher");
    expect(source).not.toContain('label: "Aktive kunder"');
  });

  test("provider dashboard has no duplicate top-right locale switcher", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/page.tsx"), "utf8");
    expect(source).not.toContain("LocaleSwitcher");
    expect(source).not.toContain("ds-provider-topbar__locale");
  });

  test("provider shell sidebar retains locale switcher", () => {
    const source = readFileSync(resolve(process.cwd(), "components/providers/ProviderNav.tsx"), "utf8");
    expect(source).toContain("<LocaleSwitcher");
    expect(source).toContain("ds-provider-nav__locale");
  });

  test("nb messages include dashboard shell defaults", async () => {
    const messages = await loadMessagesForLocale("nb");
    const dashboard = messages.provider as { dashboard: Record<string, string> };
    expect(dashboard.dashboard.eyebrow).toBe("Leverandør");
    expect(dashboard.dashboard.activeCustomers).toBe("Aktive kunder");
    expect(dashboard.dashboard.quickActionsSection).toBe("Hurtighandlinger");
  });

  test("en messages include dashboard shell translations", async () => {
    const messages = await loadMessagesForLocale("en");
    const dashboard = messages.provider as { dashboard: Record<string, string> };
    expect(dashboard.dashboard.eyebrow).toBe("Provider");
    expect(dashboard.dashboard.activeCustomers).toBe("Active customers");
    expect(dashboard.dashboard.quickActionsSection).toBe("Quick actions");
  });

  test("dashboard page translates activity feed via provider.dashboard.activity", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/page.tsx"), "utf8");
    expect(source).toContain("translateActivity");
    expect(source).toContain('t(`activity.${item.messageId}.title`)');
    expect(source).toContain(".map((item) => translateActivity(item, t))");
  });

  test("en activity messages include English dashboard activity copy", async () => {
    const messages = await loadMessagesForLocale("en");
    const activity = (
      messages.provider as { dashboard: { activity: Record<string, { title: string; description: string }> } }
    ).dashboard.activity;
    expect(activity.orderReceived.title).toBe("Order received");
    expect(activity.menuPublished.description).toContain("visible to customers");
  });
});

describe("ProviderNav i18n", () => {
  test("ProviderNav uses useTranslations for provider.nav", async () => {
    const source = readFileSync(resolve(process.cwd(), "components/providers/ProviderNav.tsx"), "utf8");
    expect(source).toContain('useTranslations("provider.nav")');
    expect(source).toContain("labelKey");
    expect(source).not.toContain('label: "Ordrer"');
  });

  test("provider shell sidebar retains locale switcher", () => {
    const source = readFileSync(resolve(process.cwd(), "components/providers/ProviderNav.tsx"), "utf8");
    expect(source).toContain("<LocaleSwitcher");
    expect(source).toContain("ds-provider-nav__locale");
  });

  test("ProviderNav wires LocaleSwitcher in provider shell", () => {
    const source = readFileSync(resolve(process.cwd(), "components/providers/ProviderNav.tsx"), "utf8");
    expect(source).toContain("<LocaleSwitcher");
    expect(source).toContain("persistProfile");
  });

  test("ProviderNav aria-labels use i18n keys not hardcoded Norwegian", () => {
    const source = readFileSync(resolve(process.cwd(), "components/providers/ProviderNav.tsx"), "utf8");
    expect(source).toContain('t("sidebarLabel")');
    expect(source).toContain('t("desktopLabel")');
    expect(source).toContain('t("mobileLabel")');
    expect(source).not.toContain('aria-label="Leverandør"');
    expect(source).not.toContain('aria-label="Leverandør (desktop)"');
    expect(source).not.toContain('aria-label="Hovednavigasjon (mobil)"');
  });

  test("renders English nav labels when locale is en", async () => {
    const messages = await loadMessagesForLocale("en");
    const { default: ProviderNav } = await import("@/components/providers/ProviderNav");

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProviderNav
          providerName="Melhus Catering AS"
          logoUrl={null}
          userRole="provider_admin"
          providerAdmin
        />
      </NextIntlClientProvider>,
    );

    expect(html).toContain("Orders");
    expect(html).toContain("Customers");
    expect(html).toContain("Menu");
    expect(html).toContain("Settings");
    expect(html).toContain("Melhus Catering AS");
    expect(html).toContain('aria-label="Provider (desktop)"');
    expect(html).toContain('aria-label="Main navigation (mobile)"');
  });

  test("renders Norwegian nav aria-labels when locale is nb", async () => {
    const messages = await loadMessagesForLocale("nb");
    const { default: ProviderNav } = await import("@/components/providers/ProviderNav");

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderNav
          providerName="Melhus Catering AS"
          logoUrl={null}
          userRole="provider_admin"
          providerAdmin
        />
      </NextIntlClientProvider>,
    );

    expect(html).toContain("Ordrer");
    expect(html).toContain('aria-label="Leverandør (desktop)"');
    expect(html).toContain('aria-label="Hovednavigasjon (mobil)"');
  });
});

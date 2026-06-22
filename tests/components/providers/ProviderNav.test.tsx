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
    const locales = ["nb", "en", "sv", "da", "fi", "de", "fr", "es"] as const;
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
});

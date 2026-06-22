import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";

import { APP_LOCALES, getLocaleLabel } from "@/lib/i18n/localeRegistry";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("LocaleSwitcher", () => {
  it("renders all eight locale options with native labels", async () => {
    const messages = await loadMessagesForLocale("nb");
    const { default: LocaleSwitcher } = await import("@/components/nav/LocaleSwitcher");

    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <LocaleSwitcher />
      </NextIntlClientProvider>,
    );

    for (const code of APP_LOCALES) {
      expect(html).toContain(`value="${code}"`);
      expect(html).toContain(getLocaleLabel(code));
    }
  });

  it("persists profile only for nb/en until DB migration", () => {
    const source = readFileSync(resolve(process.cwd(), "components/nav/LocaleSwitcher.tsx"), "utf8");
    expect(source).toContain("isProfilePersistLocale");
    expect(source).toContain("persistLocalePreference");
    expect(source).toContain("profiles.preferred_locale CHECK");
    expect(source).toContain("setLocaleCookie");
    expect(source).toContain("router.refresh");
  });
});

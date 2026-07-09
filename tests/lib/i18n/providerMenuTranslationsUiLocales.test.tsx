import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import { APP_LOCALES } from "@/lib/i18n/localeRegistry";
import { loadMessagesForLocale } from "@/lib/i18n/messages";

type MenuMessages = {
  provider: {
    menu: {
      header: { eyebrow: string };
      translations: {
        listTitle: string;
        coverageTitle: string;
        missingTitle: string;
        introApproved: string;
        introPartialCoverage: string;
        saveDraft: string;
        approve: string;
        reject: string;
        createLead: string;
      };
      translationsPage: { title: string; backToMenu: string };
      legacyEditor: { saveDraft: string; publishMenu: string };
      page: { translationsPromoTitle: string };
    };
  };
};

const LOCALIZED_TRANSLATIONS_PAGE_TITLE: Record<(typeof APP_LOCALES)[number], string> = {
  nb: "Menyoversettelser",
  en: "Menu translations",
  da: "Menuoversættelser",
  de: "Menüübersetzungen",
  es: "Traducciones del menú",
  fr: "Traductions du menu",
  it: "Traduzioni menu",
  fi: "Menun käännökset",
  sv: "Menyöversättningar",
};

const NON_NORWEGIAN_UI_LOCALES = ["en", "de", "es", "fr", "it", "fi"] as const;

/** Locales that must not reuse English scaffold for visible panel copy. */
const NO_ENGLISH_SCAFFOLD_LOCALES = ["de", "es", "fr", "it", "fi"] as const;

const PANEL_COPY_KEYS = [
  "introApproved",
  "introPartialCoverage",
  "coverageTitle",
  "missingTitle",
  "saveDraft",
  "approve",
  "reject",
  "createLead",
] as const;

async function renderTranslationsPanel(locale: (typeof APP_LOCALES)[number]) {
  const messages = await loadMessagesForLocale(locale);
  const ProviderMenuTranslationsPanel = (
    await import("@/app/leverandor/meny/oversettelser/ProviderMenuTranslationsPanel")
  ).default;
  return {
    html: renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ProviderMenuTranslationsPanel canWrite={false} />
      </NextIntlClientProvider>,
    ),
    messages: messages as MenuMessages,
  };
}

async function renderMenuBuilder(locale: (typeof APP_LOCALES)[number]) {
  const messages = await loadMessagesForLocale(locale);
  const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
  return {
    html: renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ProviderMenuBuilder workspacePresentation={{ active: false }} />
      </NextIntlClientProvider>,
    ),
    messages: messages as MenuMessages,
  };
}

describe("provider menu UI locale coverage (9 languages)", () => {
  it("all 9 locales define localized translationsPage.title", async () => {
    for (const locale of APP_LOCALES) {
      const messages = (await loadMessagesForLocale(locale)) as MenuMessages;
      expect(messages.provider.menu.translationsPage.title).toBe(
        LOCALIZED_TRANSLATIONS_PAGE_TITLE[locale],
      );
    }
  });

  it.each(APP_LOCALES)(
    "translations panel renders localized chrome for locale %s",
    async (locale) => {
      const { html, messages } = await renderTranslationsPanel(locale);
      const t = messages.provider.menu.translations;
      expect(html).toContain(t.listTitle);
      expect(html).toContain(t.coverageTitle);
      expect(html).toContain(t.introApproved);
      if ((NON_NORWEGIAN_UI_LOCALES as readonly string[]).includes(locale)) {
        expect(html).not.toContain("Kun godkjente oversettelser");
        expect(html).not.toContain("Dekning per språk");
      }
    },
  );

  it.each(APP_LOCALES)("menu builder renders localized header for locale %s", async (locale) => {
    const { html, messages } = await renderMenuBuilder(locale);
    expect(html).toContain(messages.provider.menu.header.eyebrow);
    if (locale !== "nb") {
      expect(html).not.toContain("Meny-editor");
    }
  });

  it("messages parity — all 9 locales include provider.menu translation keys", async () => {
    for (const locale of APP_LOCALES) {
      const messages = (await loadMessagesForLocale(locale)) as MenuMessages;
      expect(messages.provider.menu.translations.listTitle.length).toBeGreaterThan(0);
      expect(messages.provider.menu.translations.saveDraft.length).toBeGreaterThan(0);
      expect(messages.provider.menu.translationsPage.title.length).toBeGreaterThan(0);
      expect(messages.provider.menu.legacyEditor.saveDraft.length).toBeGreaterThan(0);
      expect(messages.provider.menu.page.translationsPromoTitle.length).toBeGreaterThan(0);
    }
  });

  it("de/es/fr/it/fi must not reuse English scaffold for visible panel copy", async () => {
    const enMessages = (await loadMessagesForLocale("en")) as MenuMessages;
    const enCopy = enMessages.provider.menu.translations;

    for (const locale of NO_ENGLISH_SCAFFOLD_LOCALES) {
      const messages = (await loadMessagesForLocale(locale)) as MenuMessages;
      const localized = messages.provider.menu.translations;

      for (const key of PANEL_COPY_KEYS) {
        expect(
          localized[key],
          `${locale}.provider.menu.translations.${key} must not match en.json scaffold`,
        ).not.toBe(enCopy[key]);
      }
    }
  });

  it("legacy editor source uses i18n keys", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync("components/providers/ProviderMenuEditor.tsx", "utf8");
    expect(source).toContain('useTranslations("provider.menu.legacyEditor")');
    expect(source).not.toContain("Lagre utkast");
    expect(source).not.toContain("Publiser meny");
  });
});

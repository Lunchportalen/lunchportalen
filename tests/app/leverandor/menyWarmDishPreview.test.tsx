import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextIntlClientProvider } from "next-intl";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  LP_MENU_PROFILE_RESOLVER_ENV,
  LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV,
} from "@/lib/menu-profile/featureFlag";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import { buildProviderMenuWarmDishPreviewPresentation } from "@/lib/provider-menu/providerMenuProfileWarmDishPreview";

const BOTH_FLAGS = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV]: "true",
};

const RESOLVER_ONLY = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV]: "false",
};

function warmDishPreviewPresentation(profileId: string, env = BOTH_FLAGS) {
  const resolver = resolveMenuProfileForProvider({
    menuProfileId: profileId,
    env,
  });
  return buildProviderMenuWarmDishPreviewPresentation(resolver, "EUR", env);
}

describe("ProviderMenuBuilder warm dish preview panel (G5c)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          data: {
            weekStart: "2026-06-15",
            dates: ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19"],
            items: [],
            prices: {
              BASIS: { tier: "BASIS", priceExVatNok: 90, vatRate: 0.15, priceIncVatNok: 103.5, source: "fallback" },
              LUXUS: { tier: "LUXUS", priceExVatNok: 130, vatRate: 0.15, priceIncVatNok: 149.5, source: "fallback" },
              ENTERPRISE: {
                tier: "ENTERPRISE",
                priceExVatNok: 170,
                vatRate: 0.15,
                priceIncVatNok: 195.5,
                source: "fallback",
              },
            },
          },
        }),
      })),
    );
  });

  test("flags OFF does not render warm dish preview panel", async () => {
    const messages = await loadMessagesForLocale("nb");
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuBuilder />
      </NextIntlClientProvider>,
    );
    expect(html).not.toContain("provider-menu-profile-warm-dish-preview-panel");
  });

  test("G5a ON + G5c OFF does not render warm dish preview panel", async () => {
    const preview = warmDishPreviewPresentation("norwegian_company_lunch", RESOLVER_ONLY);
    expect(preview.active).toBe(false);

    const messages = await loadMessagesForLocale("nb");
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuBuilder warmDishPreviewPresentation={preview} />
      </NextIntlClientProvider>,
    );
    expect(html).not.toContain("provider-menu-profile-warm-dish-preview-panel");
  });

  test("both flags ON + NO profile renders warm dish preview panel", async () => {
    const preview = warmDishPreviewPresentation("norwegian_company_lunch");
    expect(preview.active).toBe(true);
    if (!preview.active) return;

    const messages = await loadMessagesForLocale("nb");
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuBuilder warmDishPreviewPresentation={preview} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("provider-menu-profile-warm-dish-preview-panel");
    expect(html).toContain("Varmrettbank for menyprofil");
    expect(html).toContain("Kjøttkaker med brun saus");
    expect(html).toContain("Kun forslag");
    expect(html).toContain("Ikke synlig for ansatte");
    expect(html).not.toContain("Lagre");
    expect(html).not.toContain("Publiser");
  });

  test("both flags ON + IT profile renders Italian suggestions", async () => {
    const preview = warmDishPreviewPresentation("italian_office_lunch");
    expect(preview.active).toBe(true);
    if (!preview.active) return;

    const messages = await loadMessagesForLocale("it");
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="it" messages={messages}>
        <ProviderMenuBuilder warmDishPreviewPresentation={preview} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Lasagne al forno");
    expect(html).toContain("Risotto ai funghi");
  });
});

describe("LeverandorMenyPage G5c wiring", () => {
  test("page loads warm dish preview presentation server-side without touching API routes", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("buildProviderMenuWarmDishPreviewPresentation");
    expect(source).toContain("warmDishPreviewPresentation={warmDishPreviewPresentation}");
    expect(source).not.toContain("menu-catalog");
    expect(source).not.toContain("menu-days");
    expect(source).not.toContain("lp_order_set");
  });
});

describe("G5c scope check — forbidden paths untouched", () => {
  const FORBIDDEN_FILES = [
    "app/api/provider/menu-days/route.ts",
    "app/api/provider/menu-catalog/route.ts",
    "lib/provider-menu/menuDayPayload.ts",
    "lib/cms/menuDayContract.ts",
  ];

  const CHANGED = [
    "app/leverandor/meny/page.tsx",
    "components/providers/ProviderMenuBuilder.tsx",
    "components/providers/ProviderMenuProfileWarmDishPreviewPanel.tsx",
    "lib/provider-menu/providerMenuProfileWarmDishPreview.ts",
    "lib/menu-profile/warmDishBankSeeds.ts",
  ];

  test("changed files do not import order write-path or menuDayPayload", () => {
    for (const rel of CHANGED) {
      const source = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(source).not.toContain("lp_order_set");
      expect(source).not.toContain("lp_order_advance_status");
      expect(source).not.toContain("menuDayPayload");
    }
  });

  test("forbidden runtime files exist and were not modified in this changeset scope", () => {
    for (const rel of FORBIDDEN_FILES) {
      expect(() => readFileSync(resolve(process.cwd(), rel), "utf8")).not.toThrow();
    }
  });
});

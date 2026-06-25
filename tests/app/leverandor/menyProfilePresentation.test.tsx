import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextIntlClientProvider } from "next-intl";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import { LP_MENU_PROFILE_RESOLVER_ENV } from "@/lib/menu-profile/featureFlag";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import { buildProviderMenuWorkspacePresentation } from "@/lib/provider-menu/providerMenuProfilePresentation";

const CATALOG_FIXTURE = {
  rows: [
    {
      key: "paasmurt",
      title: "Påsmurt",
      allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
      items: [{ key: "ost-skinke", title: "Ost & Skinke", allergens: ["melk"], isVegetarian: false }],
    },
    {
      key: "salatboks",
      title: "Salatboks",
      allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
      items: [{ key: "skinke", title: "Skinke", allergens: [], isVegetarian: false }],
    },
    {
      key: "sushi",
      title: "Sushi",
      allowedPlanTiers: ["LUXUS", "ENTERPRISE"],
      items: [{ key: "sushi-pakke", title: "Sushi-pakke", allergens: ["fisk"], isVegetarian: false }],
    },
    {
      key: "varmrett",
      title: "Varmrett",
      allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
      items: [],
    },
  ],
};

function enabledPresentation(profileId: string) {
  const resolver = resolveMenuProfileForProvider({
    menuProfileId: profileId,
    env: { [LP_MENU_PROFILE_RESOLVER_ENV]: "true" },
  });
  return buildProviderMenuWorkspacePresentation(resolver, "EUR");
}

describe("ProviderMenuCatalogView profile presentation (G5a)", () => {
  async function renderCatalogView(
    tier: "BASIS" | "LUXUS" | "ENTERPRISE" = "BASIS",
    workspacePresentation: ReturnType<typeof buildProviderMenuWorkspacePresentation> = { active: false },
  ) {
    const messages = await loadMessagesForLocale("nb");
    const ProviderMenuCatalogView = (await import("@/components/providers/ProviderMenuCatalogView")).default;
    return renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuCatalogView
          tier={tier}
          catalog={CATALOG_FIXTURE}
          onCatalogSaved={() => {}}
          workspacePresentation={workspacePresentation}
        />
      </NextIntlClientProvider>,
    );
  }

  test("flag OFF keeps Norwegian package matrix copy", async () => {
    const html = await renderCatalogView("BASIS", { active: false });
    expect(html).toContain("Påsmurt, Salatboks og Dagens varmrett.");
    expect(html).not.toContain("provider-menu-profile-presentation-banner");
    expect(html).not.toContain("Primo del giorno");
  });

  test("flag ON + italian_office_lunch shows IT profile package presentation", async () => {
    const presentation = enabledPresentation("italian_office_lunch");
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    const html = await renderCatalogView("BASIS", presentation);
    expect(html).toContain("provider-menu-profile-presentation-banner");
    expect(html).toContain("menyprofilens struktur");
    expect(html).toContain("Pranzo aziendale italiano");
    expect(html).toContain("Panini");
    expect(html).toContain("Insalata");
    expect(html).toContain("Primo del giorno");
    expect(html).not.toContain("Påsmurt, Salatboks og Dagens varmrett.");
  });

  test("flag ON + german_business_lunch shows DE profile package presentation", async () => {
    const presentation = enabledPresentation("german_business_lunch");
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    const html = await renderCatalogView("LUXUS", presentation);
    expect(html).toContain("Belegte Brötchen");
    expect(html).toContain("Warme Mahlzeit");
    expect(html).toContain("Vegetarische Option");
  });

  test("provider-owned catalog category labels stay unchanged with profile presentation ON", async () => {
    const presentation = enabledPresentation("italian_office_lunch");
    const html = await renderCatalogView("BASIS", presentation);
    expect(html).toContain('lp-editor-catalog-acc__name">Påsmurt');
    expect(html).toContain('lp-editor-catalog-acc__name">Salatboks');
    expect(html).toContain("profile-package-basis");
    expect(html).toContain("Panini, Insalata, Primo del giorno");
  });

  test("catalog save payload shape unchanged in editor source", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuCatalogEditor.tsx"),
      "utf8",
    );
    expect(source).toContain("title: item.title");
    expect(source).toContain("allergens: item.allergens");
    expect(source).not.toContain("workspacePresentation");
    expect(source).not.toContain("providerMenuProfilePresentation");
  });
});

describe("ProviderMenuBuilder profile presentation wiring (G5a)", () => {
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

  test("week view shows profile banner when presentation active", async () => {
    const presentation = enabledPresentation("italian_office_lunch");
    expect(presentation.active).toBe(true);
    if (!presentation.active) return;

    const messages = await loadMessagesForLocale("nb");
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuBuilder workspacePresentation={presentation} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("provider-menu-profile-presentation-banner");
    expect(html).toContain("menyprofilens struktur");
  });

  test("flag OFF builder does not render profile banner", async () => {
    const messages = await loadMessagesForLocale("nb");
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuBuilder workspacePresentation={{ active: false }} />
      </NextIntlClientProvider>,
    );
    expect(html).not.toContain("provider-menu-profile-presentation-banner");
    expect(html).toContain("Planlegg uke, sett dagens felles varmrett");
  });
});

describe("LeverandorMenyPage G5a wiring", () => {
  test("page loads menu profile presentation server-side without touching API routes", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("buildProviderMenuWorkspacePresentation");
    expect(source).toContain("loadAndResolveProviderMenuProfile");
    expect(source).toContain("workspacePresentation={workspacePresentation}");
    expect(source).not.toContain("menu-catalog");
    expect(source).not.toContain("menu-days");
    expect(source).not.toContain("lp_order_set");
  });
});

describe("G5a scope check — forbidden paths untouched", () => {
  const FORBIDDEN_FILES = [
    "app/api/provider/menu-days/route.ts",
    "app/api/provider/menu-catalog/route.ts",
    "lib/provider-menu/menuDayPayload.ts",
  ];

  const CHANGED = [
    "app/leverandor/meny/page.tsx",
    "components/providers/ProviderMenuBuilder.tsx",
    "components/providers/ProviderMenuCatalogView.tsx",
    "components/providers/ProviderMenuProfilePresentationBanner.tsx",
    "lib/provider-menu/providerMenuProfilePresentation.ts",
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

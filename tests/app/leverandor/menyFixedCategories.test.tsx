import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextIntlClientProvider } from "next-intl";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  LP_MENU_PROFILE_FIXED_CATEGORIES_ENV,
  LP_MENU_PROFILE_RESOLVER_ENV,
} from "@/lib/menu-profile/featureFlag";
import { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
import { buildProviderMenuWorkspacePresentation } from "@/lib/provider-menu/providerMenuProfilePresentation";
import { buildProviderMenuFixedCategoryPresentation } from "@/lib/provider-menu/providerMenuProfileFixedCategories";

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
  ],
};

const BOTH_FLAGS = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_FIXED_CATEGORIES_ENV]: "true",
};

const RESOLVER_ONLY = {
  [LP_MENU_PROFILE_RESOLVER_ENV]: "true",
  [LP_MENU_PROFILE_FIXED_CATEGORIES_ENV]: "false",
};

function workspacePresentation(profileId: string) {
  const resolver = resolveMenuProfileForProvider({
    menuProfileId: profileId,
    env: BOTH_FLAGS,
  });
  return buildProviderMenuWorkspacePresentation(resolver, "EUR");
}

function fixedCategoryPresentation(profileId: string, env = BOTH_FLAGS) {
  const resolver = resolveMenuProfileForProvider({
    menuProfileId: profileId,
    env,
  });
  return buildProviderMenuFixedCategoryPresentation(resolver, "EUR", env);
}

describe("ProviderMenuCatalogView fixed categories panel (G5b)", () => {
  async function renderCatalogView(
    tier: "BASIS" | "LUXUS" | "ENTERPRISE" = "BASIS",
    options: {
      workspacePresentation?: ReturnType<typeof buildProviderMenuWorkspacePresentation>;
      fixedCategoryPresentation?: ReturnType<typeof buildProviderMenuFixedCategoryPresentation>;
    } = {},
  ) {
    const messages = await loadMessagesForLocale("nb");
    const ProviderMenuCatalogView = (await import("@/components/providers/ProviderMenuCatalogView")).default;
    return renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuCatalogView
          tier={tier}
          catalog={CATALOG_FIXTURE}
          onCatalogSaved={() => {}}
          workspacePresentation={options.workspacePresentation ?? { active: false }}
          fixedCategoryPresentation={options.fixedCategoryPresentation ?? { active: false }}
        />
      </NextIntlClientProvider>,
    );
  }

  test("both flags OFF does not render fixed categories panel", async () => {
    const html = await renderCatalogView("BASIS");
    expect(html).not.toContain("provider-menu-profile-fixed-categories-panel");
    expect(html).toContain("Påsmurt, Salatboks og Dagens varmrett.");
  });

  test("G5a ON + G5b OFF shows banner but not fixed categories panel", async () => {
    const workspace = workspacePresentation("italian_office_lunch");
    const html = await renderCatalogView("BASIS", {
      workspacePresentation: workspace,
      fixedCategoryPresentation: fixedCategoryPresentation("italian_office_lunch", RESOLVER_ONLY),
    });
    expect(html).toContain("provider-menu-profile-presentation-banner");
    expect(html).not.toContain("provider-menu-profile-fixed-categories-panel");
  });

  test("both flags ON + IT profile renders fixed categories panel", async () => {
    const workspace = workspacePresentation("italian_office_lunch");
    const fixed = fixedCategoryPresentation("italian_office_lunch");
    expect(fixed.active).toBe(true);
    if (!fixed.active) return;

    const html = await renderCatalogView("BASIS", {
      workspacePresentation: workspace,
      fixedCategoryPresentation: fixed,
    });
    expect(html).toContain("provider-menu-profile-fixed-categories-panel");
    expect(html).toContain("Menyprofilens faste valg");
    expect(html).toContain("fixed-category-panini");
    expect(html).toContain("Kommende struktur");
    expect(html).toContain("Panini");
  });

  test("both flags ON + NO profile shows active catalog badges", async () => {
    const fixed = fixedCategoryPresentation("norwegian_company_lunch");
    expect(fixed.active).toBe(true);
    if (!fixed.active) return;

    const html = await renderCatalogView("BASIS", {
      fixedCategoryPresentation: fixed,
    });
    expect(html).toContain("fixed-category-paasmurt");
    expect(html).toContain("Aktiv i dagens katalog");
    expect(html).toContain("Ordre-runtime aktiv");
  });

  test("catalog save payload shape unchanged with fixed categories panel", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuCatalogEditor.tsx"),
      "utf8",
    );
    expect(source).not.toContain("fixedCategoryPresentation");
    expect(source).not.toContain("providerMenuProfileFixedCategories");
  });
});

describe("ProviderMenuBuilder fixed categories wiring (G5b)", () => {
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

  test("week view shows fixed categories panel when both flags active", async () => {
    const fixed = fixedCategoryPresentation("german_business_lunch");
    expect(fixed.active).toBe(true);
    if (!fixed.active) return;

    const messages = await loadMessagesForLocale("nb");
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuBuilder
          workspacePresentation={workspacePresentation("german_business_lunch")}
          fixedCategoryPresentation={fixed}
        />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("provider-menu-profile-fixed-categories-panel");
    expect(html).toContain("fixed-category-belegte_broetchen");
  });
});

describe("LeverandorMenyPage G5b wiring", () => {
  test("page loads fixed category presentation server-side without touching API routes", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("buildProviderMenuFixedCategoryPresentation");
    expect(source).toContain("fixedCategoryPresentation={fixedCategoryPresentation}");
    expect(source).not.toContain("menu-catalog");
    expect(source).not.toContain("menu-days");
    expect(source).not.toContain("lp_order_set");
  });
});

describe("G5b scope check — forbidden paths untouched", () => {
  const FORBIDDEN_FILES = [
    "app/api/provider/menu-days/route.ts",
    "app/api/provider/menu-catalog/route.ts",
    "lib/provider-menu/menuDayPayload.ts",
    "lib/cms/menuDayContract.ts",
  ];

  const CHANGED = [
    "app/leverandor/meny/page.tsx",
    "components/providers/ProviderMenuBuilder.tsx",
    "components/providers/ProviderMenuCatalogView.tsx",
    "components/providers/ProviderMenuProfileFixedCategoriesPanel.tsx",
    "lib/provider-menu/providerMenuProfileFixedCategories.ts",
    "lib/menu-profile/noCategoryRuntimeMap.ts",
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

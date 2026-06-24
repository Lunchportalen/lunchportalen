import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { NextIntlClientProvider } from "next-intl";

import { loadMessagesForLocale } from "@/lib/i18n/messages";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

const FALLBACK_PRICES = {
  BASIS: { tier: "BASIS", priceExVatNok: 90, vatRate: 0.15, priceIncVatNok: 103.5, source: "fallback" },
  LUXUS: { tier: "LUXUS", priceExVatNok: 130, vatRate: 0.15, priceIncVatNok: 149.5, source: "fallback" },
  ENTERPRISE: {
    tier: "ENTERPRISE",
    priceExVatNok: 170,
    vatRate: 0.15,
    priceIncVatNok: 195.5,
    source: "fallback",
  },
};

async function renderProviderMenuBuilder(locale: "nb" | "en" | "es" = "nb") {
  const messages = await loadMessagesForLocale(locale);
  const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ProviderMenuBuilder />
    </NextIntlClientProvider>,
  );
}

describe("ProviderMenuBuilder workspace layout", () => {
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
            prices: FALLBACK_PRICES,
          },
        }),
      })),
    );
  });

  test("renders command header with tier lens and priceline", async () => {
    const html = await renderProviderMenuBuilder("nb");
    expect(html).toContain("lp-editor-command-header");
    expect(html).toContain("lp-editor-tier-lens");
    expect(html).toContain("lp-editor-status-strip");
    expect(html).not.toContain("lp-editor-preview-strip");
    expect(html).toContain("Meny-editor");
    expect(html).toContain("Planlegg uke, sett dagens felles varmrett");
  });

  test("renders dual-panel workspace with week grid", async () => {
    const html = await renderProviderMenuBuilder("nb");
    expect(html).toContain("lp-editor-layout");
    expect(html).toContain("lp-editor-days");
    expect(html).toContain("lp-editor-panels");
    expect(html).toContain("lp-editor-panel--varmrett");
    expect(html).toContain("Mandag");
    expect(html).not.toContain("Pad Thai nudler");
  });

  test("day card renders mockup-aligned structure", async () => {
    const html = await renderProviderMenuBuilder("nb");
    expect(html).toContain("lp-editor-day__name");
    expect(html).toContain("lp-editor-day__catline");
    expect(html).toContain("lp-editor-day__editbtn");
    expect(html).toContain("Varmrett mangler");
    expect(html).toContain("Legg inn dagens varmrett før denne dagen kan publiseres.");
  });

  test("panel idle guides day selection", async () => {
    const html = await renderProviderMenuBuilder("nb");
    expect(html).toContain("lp-editor-panel__idle");
    expect(html).toContain("Klikk en dag i ukeplanen");
  });

  test("workspace components separated in source", () => {
    const builder = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"), "utf8");
    expect(builder).toContain("resolveSharedVarmrettSlot");
    expect(builder).not.toContain("lp_order_set");
  });

  test("week planner uses shared warm dish read-model", () => {
    const planner = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuWeekPlanner.tsx"), "utf8");
    expect(planner).toContain("getWeekdayCategoryPin");
    expect(planner).toContain("enterprise-upgrade");
    expect(planner).toContain("lp-editor-day__lockbar");
    expect(planner).not.toContain("ds-provider-menu-day__variant-row");
    expect(planner).not.toMatch(/varmmrett/i);
  });

  test("editor panel separates warm dish from enterprise upgrade", () => {
    const editor = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuEditorPanel.tsx"), "utf8");
    const workspace = readFileSync(resolve(process.cwd(), "lib/provider-menu/providerMenuWorkspace.ts"), "utf8");
    expect(workspace).toContain("felles for alle pakker");
    expect(workspace).toContain("Enterprise-upgrade");
    expect(editor).toContain('useTranslations("provider.menu")');
    expect(editor).toContain('t("editor.enterprise.suggestedTitle")');
    expect(editor).toContain('t("editor.enterprise.useSuggestion")');
    expect(editor).toContain('t("editor.enterprise.editManual")');
    expect(editor).toContain('t("editor.enterprise.sameWarmMealNote")');
    expect(editor).toContain("isEnterpriseUpgradeMode");
    expect(editor).toContain("lp-editor-panel-varmrett");
    expect(editor).toContain('t("editor.economy.commission")');
    expect(editor).not.toMatch(/varmmrett/i);
  });

  test("no Varmmrett typo in provider menu UI surfaces", () => {
    const files = [
      "components/providers/ProviderMenuBuilder.tsx",
      "components/providers/ProviderMenuEditorPanel.tsx",
      "components/providers/ProviderMenuWeekPlanner.tsx",
      "components/providers/ProviderMenuCommandHeader.tsx",
      "components/providers/ProviderMenuStatusRow.tsx",
      "lib/provider-menu/providerMenuWorkspace.ts",
    ];
    for (const rel of files) {
      const source = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(source).not.toMatch(/varmmrett/i);
    }
  });
});

describe("ProviderMenuCatalogEditor accordion", () => {
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
        key: "pokebowl",
        title: "Pokebowl",
        allowedPlanTiers: ["LUXUS", "ENTERPRISE"],
        items: [{ key: "laks", title: "Laks", allergens: ["fisk"], isVegetarian: false }],
      },
      {
        key: "thaimat",
        title: "Thaimat",
        allowedPlanTiers: ["LUXUS", "ENTERPRISE"],
        items: [{ key: "pad-thai", title: "Pad Thai", allergens: [], isVegetarian: false }],
      },
    ],
  };

  async function renderCatalogEditor(
    locale: "nb" | "en" | "de" = "nb",
    props: {
      tier?: "BASIS" | "LUXUS" | "ENTERPRISE";
      initialOpenCategoryKey?: string;
    } = {},
  ) {
    const messages = await loadMessagesForLocale(locale);
    const ProviderMenuCatalogEditor = (await import("@/components/providers/ProviderMenuCatalogEditor")).default;
    return renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages}>
        {React.createElement(ProviderMenuCatalogEditor, {
          tier: props.tier ?? "ENTERPRISE",
          catalog: CATALOG_FIXTURE,
          onCatalogSaved: () => {},
          panelMode: true,
          initialOpenCategoryKey: props.initialOpenCategoryKey ?? "paasmurt",
        })}
      </NextIntlClientProvider>,
    );
  }

  test("accordion shows all five categories with tier badges and isolate banner", async () => {
    const html = await renderCatalogEditor("nb");
    expect(html).toContain("Menykatalog");
    expect(html).toContain("Valgene du tilbyr under hver kategori");
    expect(html).toContain("Din egen katalog");
    expect(html).toContain("Isolert");
    expect(html).toContain("Påsmurt");
    expect(html).toContain("Salatboks");
    expect(html).toContain("Sushi");
    expect(html).toContain("Pokebowl");
    expect(html).toContain("Thaimat");
    expect(html).toContain("Alle nivåer");
    expect(html).toContain("Luxus + Enterprise");
    expect(html).toContain("lp-editor-catalog-accordion");
  });

  test("open category shows Legg til valg row", async () => {
    const html = await renderCatalogEditor("nb", { tier: "BASIS" });
    expect(html).toContain("+ Legg til valg");
    expect(html).toContain("Lagre katalog");
    expect(html).toContain("Avbryt");
  });

  test("catalog editor source has no RID logging or Varmmrett typo", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuCatalogEditor.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/varmmrett/i);
    expect(source).not.toMatch(/RID:/);
    expect(source).toContain("/api/provider/menu-catalog");
    expect(source).toContain('useTranslations("provider.menu")');
  });
});

describe("LeverandorMenyPage full-width frame", () => {
  test("page uses full-width editor frame without locale switcher or duplicate branding", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("lp-editor-page");
    expect(source).not.toContain("LocaleSwitcher");
    expect(source).not.toContain("lp-editor-topbar");
    expect(source).not.toContain("LP-logo-uten-bakgrunn");
    expect(source).not.toContain("lp-editor-topbar__brand");
    expect(source).not.toContain("lp-editor-topbar__who");
    expect(source).not.toContain("lp-editor-topbar__avatar");
    expect(source).not.toContain("ds-container");
    expect(source).not.toContain('className="ds-h2">Meny</h1>');
  });

  test("page uses getTranslations for read-only gate", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain('getTranslations("provider.menu.page")');
    expect(source).toContain('t("readOnlyTitle")');
    expect(source).not.toContain("Kun visning");
  });
});

const PREVIEW_PAYLOAD = {
  preview: true as const,
  resolverVersion: "r4d-preview-v1" as const,
  marketCode: "NO" as const,
  aggregateSource: "provider_price_rules_market" as const,
  tiers: {
    BASIS: {
      amountExVat: 95,
      priceIncVatNok: 109.25,
      currency: "NOK",
      vatRate: 0.15,
      taxBasis: "ex_tax",
      taxCategory: "food_catering",
      source: "provider_price_rules_market" as const,
      rowSource: "seed",
      differsFromProduction: true,
    },
    LUXUS: {
      amountExVat: 130,
      priceIncVatNok: 149.5,
      currency: "NOK",
      vatRate: 0.15,
      taxBasis: "ex_tax",
      taxCategory: "food_catering",
      source: "provider_price_rules_market" as const,
      rowSource: "seed",
      differsFromProduction: false,
    },
    ENTERPRISE: {
      amountExVat: 170,
      priceIncVatNok: 195.5,
      currency: "NOK",
      vatRate: 0.15,
      taxBasis: "ex_tax",
      taxCategory: "food_catering",
      source: "provider_price_rules_market" as const,
      rowSource: "seed",
      differsFromProduction: false,
    },
  },
};

describe("ProviderMenuPricePreviewStrip", () => {
  async function renderPreviewStrip(
    pricePreview: typeof PREVIEW_PAYLOAD | null,
    tier: "BASIS" | "LUXUS" | "ENTERPRISE" = "BASIS",
  ) {
    const messages = await loadMessagesForLocale("nb");
    const ProviderMenuPricePreviewStrip = (
      await import("@/components/providers/ProviderMenuPricePreviewStrip")
    ).default;
    return renderToStaticMarkup(
      <NextIntlClientProvider locale="nb" messages={messages}>
        <ProviderMenuPricePreviewStrip tier={tier} pricePreview={pricePreview} />
      </NextIntlClientProvider>,
    );
  }

  test("does not render when pricePreview is absent", async () => {
    const html = await renderPreviewStrip(null);
    expect(html).toBe("");
  });

  test("renders preview strip with disclaimer when pricePreview is present", async () => {
    const html = await renderPreviewStrip(PREVIEW_PAYLOAD);
    expect(html).toContain("lp-editor-preview-strip");
    expect(html).toContain("Pris-preview");
    expect(html).toContain("Kun diagnose — brukes ikke til ordre, margin eller publisering.");
    expect(html).toContain("95");
    expect(html).toContain("Avviker fra produksjonspris");
    expect(html).toContain("NO · NOK · eks. mva · seed");
  });

  test("shows differs badge only for active tier when flagged", async () => {
    const htmlBasis = await renderPreviewStrip(PREVIEW_PAYLOAD, "BASIS");
    expect(htmlBasis).toContain("Avviker fra produksjonspris");

    const htmlLuxus = await renderPreviewStrip(PREVIEW_PAYLOAD, "LUXUS");
    expect(htmlLuxus).not.toContain("Avviker fra produksjonspris");
  });

  test("builder keeps tierPrice sourced from prices not preview", () => {
    const builder = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"), "utf8");
    expect(builder).toContain("const tierPrice = prices?.[tier]");
    expect(builder).not.toMatch(/tierPrice\s*=\s*pricePreview/);
    expect(builder).not.toContain("setPrices(json.data.pricePreview");
    expect(builder).toContain("setPricePreview(json.data.pricePreview ?? null)");
    expect(builder).toContain("<ProviderMenuPricePreviewStrip tier={tier} pricePreview={pricePreview} />");
  });
});

describe("ProviderMenuBuilder i18n", () => {
  test("nb default shows Meny-editor and Ukeplan", async () => {
    const html = await renderProviderMenuBuilder("nb");
    expect(html).toContain("Meny-editor");
    expect(html).toContain("Ukeplan");
    expect(html).toContain("Basis");
    expect(html).toContain("Luxus");
    expect(html).toContain("Enterprise");
  });

  test("en locale shows Menu editor and Week plan", async () => {
    const html = await renderProviderMenuBuilder("en");
    expect(html).toContain("Menu editor");
    expect(html).toContain("Week plan");
    expect(html).toContain("Basis");
    expect(html).toContain("Luxus");
    expect(html).toContain("Enterprise");
    expect(html).not.toContain("Meny-editor");
  });

  test("es locale shows Editor de menú and Plan semanal", async () => {
    const html = await renderProviderMenuBuilder("es");
    expect(html).toContain("Editor de menú");
    expect(html).toContain("Plan semanal");
    expect(html).toContain("Basis");
    expect(html).not.toContain("Meny-editor");
  });

  test("command header and week planner use useTranslations", () => {
    const header = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuCommandHeader.tsx"),
      "utf8",
    );
    const planner = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuWeekPlanner.tsx"),
      "utf8",
    );
    const editorPanel = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuEditorPanel.tsx"),
      "utf8",
    );
    const catalogView = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuCatalogView.tsx"),
      "utf8",
    );
    expect(header).toContain('useTranslations("provider.menu")');
    expect(planner).toContain('useTranslations("provider.menu")');
    expect(editorPanel).toContain('useTranslations("provider.menu")');
    expect(catalogView).toContain('useTranslations("provider.menu")');
  });

  test("ProviderMenuBuilder uses i18n for error and success fallbacks", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"),
      "utf8",
    );
    expect(source).toContain('t("errors.copySourceEmpty"');
    expect(source).toContain('t("success.copiedFromTier"');
    expect(source).toContain("resolveProviderMenuApiError");
    expect(source).toContain("resolvePublishConfirmPresentation");
    expect(source).toContain('t("workspace.emptyPanel.selectDay")');
    expect(source).not.toContain('warning: warnings[0]');
    expect(source).not.toContain("Kunne ikke lagre meny.");
    expect(source).not.toContain("Kunne ikke tilbakestille varmrett.");
    expect(source).not.toContain("Bekreft for å publisere likevel.");
    expect(source).not.toContain("Velg en dag i ukeplanen");
  });

  test("ProviderMenuEditor legacy save errors use i18n resolver", () => {
    const source = readFileSync(
      resolve(process.cwd(), "components/providers/ProviderMenuEditor.tsx"),
      "utf8",
    );
    expect(source).toContain("resolveProviderMenuApiError");
    expect(source).toContain('t("errors.saveFailed")');
    expect(source).not.toContain("Kunne ikke lagre menyen");
    expect(source).not.toContain("json.message");
  });
});

describe("Provider menu editor and catalog i18n", () => {
  async function renderEditorPanelIdle(locale: "nb" | "en" | "de" = "en") {
    const messages = await loadMessagesForLocale(locale);
    const ProviderMenuEditorPanel = (await import("@/components/providers/ProviderMenuEditorPanel")).default;
    return renderToStaticMarkup(
      <NextIntlClientProvider locale={locale} messages={messages}>
        <ProviderMenuEditorPanel
          open={false}
          context={null}
          form={null}
          layoutMode="panel"
          onFormChange={() => {}}
          onClose={() => {}}
          onSaveDraft={() => {}}
          onPublish={() => {}}
          onCopyFromBasis={() => {}}
          onCopyFromLuxus={() => {}}
          pending={false}
          margin={null}
          enterpriseWarnings={[]}
          confirmWarnings={false}
          onConfirmWarningsChange={() => {}}
          tier="LUXUS"
        />
      </NextIntlClientProvider>,
    );
  }

  test("en editor idle shows English labels", async () => {
    const html = await renderEditorPanelIdle("en");
    expect(html).toContain("Select a day");
    expect(html).toContain("Click a day in the week plan");
    expect(html).not.toContain("Velg en dag");
  });

  test("de editor idle shows German labels", async () => {
    const html = await renderEditorPanelIdle("de");
    expect(html).toContain("Tag auswählen");
    expect(html).not.toContain("Select a day");
  });

  test("en varmrett panel shows Save hot meal / Cancel / Reset to generated and economy labels", async () => {
    const messages = await loadMessagesForLocale("en");
    const ProviderMenuEditorPanel = (await import("@/components/providers/ProviderMenuEditorPanel")).default;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ProviderMenuEditorPanel
          open
          layoutMode="panel"
          tier="LUXUS"
          context={{
            tierLabel: "Luxus",
            weekdayLabel: "Monday",
            weekdayKey: "tue",
            date: "2026-06-16",
            categoryLabel: "Varmrett",
            variantLabel: null,
            editorFocus: "varmrett",
            mode: "varmrett",
          }}
          form={{
            date: "2026-06-16",
            tier: "LUXUS",
            category: "varmrett",
            mealTitle: "Kyllinggryte",
            description: "Provider-owned description",
            allergensText: "melk",
            estimatedCostPerPortion: 45,
            sourcePackage: null,
            upgradeType: null,
            upgradeNote: "",
            status: "draft",
            contentSource: "draft",
          }}
          onFormChange={() => {}}
          onClose={() => {}}
          onSaveDraft={() => {}}
          onPublish={() => {}}
          onCopyFromBasis={() => {}}
          onCopyFromLuxus={() => {}}
          pending={false}
          margin={{
            priceExVatNok: 130,
            estimatedCostNok: 45,
            grossMarginNok: 85,
            marginPercent: 65,
          }}
          enterpriseWarnings={[]}
          confirmWarnings={false}
          onConfirmWarningsChange={() => {}}
          varmrettHasGeneratedBaseline
          onResetToGenerated={() => {}}
        />
      </NextIntlClientProvider>,
    );

    expect(html).toContain("lp-editor-panel-varmrett");
    expect(html).toContain("Save hot meal");
    expect(html).toContain("Cancel");
    expect(html).toContain("Reset to generated");
    expect(html).toContain("Raw material cost (kr)");
    expect(html).toContain("Margin per portion");
    expect(html).toContain("Shared · Basis, Luxus, Enterprise");
    expect(html).toContain("Kyllinggryte");
    expect(html).not.toContain("Lagre varmrett");
    expect(html).not.toContain("Tilbakestill til generert");
  });

  test("en catalog shows Menu catalog / Add choice / Save catalog", async () => {
    const messages = await loadMessagesForLocale("en");
    const ProviderMenuCatalogEditor = (await import("@/components/providers/ProviderMenuCatalogEditor")).default;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={messages}>
        {React.createElement(ProviderMenuCatalogEditor, {
          tier: "BASIS",
          catalog: {
            rows: [
              {
                key: "paasmurt",
                title: "Påsmurt",
                allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
                items: [{ key: "ost-skinke", title: "Ost & Skinke", allergens: ["melk"], isVegetarian: false }],
              },
            ],
          },
          onCatalogSaved: () => {},
          panelMode: true,
          initialOpenCategoryKey: "paasmurt",
        })}
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Menu catalog");
    expect(html).toContain("+ Add choice");
    expect(html).toContain("Save catalog");
    expect(html).toContain("Ost &amp; Skinke");
    expect(html).not.toContain("Menykatalog");
  });

  test("de catalog keeps Basis/Luxus/Enterprise and provider catalog titles", async () => {
    const messages = await loadMessagesForLocale("de");
    const ProviderMenuCatalogEditor = (await import("@/components/providers/ProviderMenuCatalogEditor")).default;
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="de" messages={messages}>
        {React.createElement(ProviderMenuCatalogEditor, {
          tier: "ENTERPRISE",
          catalog: {
            rows: [
              {
                key: "paasmurt",
                title: "Påsmurt",
                allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
                items: [{ key: "ost-skinke", title: "Ost & Skinke", allergens: [], isVegetarian: false }],
              },
              {
                key: "sushi",
                title: "Sushi",
                allowedPlanTiers: ["LUXUS", "ENTERPRISE"],
                items: [{ key: "sushi-pakke", title: "Sushi-pakke", allergens: [], isVegetarian: false }],
              },
            ],
          },
          onCatalogSaved: () => {},
          panelMode: true,
          initialOpenCategoryKey: "paasmurt",
        })}
      </NextIntlClientProvider>,
    );
    expect(html).toContain("Menükatalog");
    expect(html).toContain("Luxus + Enterprise");
    expect(html).toContain("Ost &amp; Skinke");
    expect(html).toContain("Påsmurt");
    expect(html).not.toContain("Menu catalog");
  });
});

describe("ProviderNav kitchen-only menu access", () => {
  test("kitchen-only nav includes Meny link to /leverandor/meny", () => {
    const source = readFileSync(resolve(process.cwd(), "components/providers/ProviderNav.tsx"), "utf8");
    expect(source).toContain('href: "/leverandor/meny", labelKey: "menu"');
    const kitchenBlock = source.slice(source.indexOf("if (!kitchenOnly)"));
    expect(kitchenBlock).toMatch(/kitchenOnly[\s\S]*\/leverandor\/meny[\s\S]*labelKey: "menu"/);
  });
});

describe("provider menu safety guards", () => {
  const guardedFiles = [
    "components/providers/ProviderMenuBuilder.tsx",
    "components/providers/ProviderMenuEditorPanel.tsx",
    "components/providers/ProviderMenuWeekPlanner.tsx",
    "lib/provider-menu/providerMenuWorkspace.ts",
  ];

  test("provider menu surfaces do not import order write-path", () => {
    for (const rel of guardedFiles) {
      const source = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(source).not.toContain("lp_order_set");
      expect(source).not.toContain("lp_order_advance_status");
    }
  });

  test("no /week write-flow changes", () => {
    const builder = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"), "utf8");
    expect(builder).not.toMatch(/app\/\(app\)\/week/);
  });
});

describe("menu contract unchanged", () => {
  test("Basis still three categories; variants from Sanity catalog not tier contract", () => {
    const tierSource = readFileSync(resolve(process.cwd(), "lib/provider-menu/providerMenuTierContract.ts"), "utf8");
    expect(tierSource).toContain("categoriesForTierInOrder(PLAN_CATEGORIES.BASIS)");
    expect(tierSource).toContain("variants: []");
    expect(tierSource).toContain("lunchCategoryCatalog.ts");

    const catalogSource = readFileSync(
      resolve(process.cwd(), "tests/lib/provider-menu/lunchCategoryCatalogFixtures.ts"),
      "utf8",
    );
    expect(catalogSource).toContain("Ost & Skinke");
  });
});

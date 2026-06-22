import { describe, expect, test, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("lp-editor-command-header");
    expect(html).toContain("lp-editor-tier-lens");
    expect(html).toContain("lp-editor-status-strip");
    expect(html).toContain("Meny-editor");
    expect(html).toContain("Planlegg uke, sett dagens felles varmrett");
  });

  test("renders dual-panel workspace with week grid", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("lp-editor-layout");
    expect(html).toContain("lp-editor-days");
    expect(html).toContain("lp-editor-panels");
    expect(html).toContain("lp-editor-panel--varmrett");
    expect(html).toContain("Mandag");
    expect(html).not.toContain("Pad Thai nudler");
  });

  test("day card renders mockup-aligned structure", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("lp-editor-day__name");
    expect(html).toContain("lp-editor-day__catline");
    expect(html).toContain("lp-editor-day__editbtn");
    expect(html).toContain("Varmrett mangler");
    expect(html).toContain("Legg inn dagens varmrett før denne dagen kan publiseres.");
  });

  test("panel idle guides day selection", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
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
    expect(editor).toContain("Foreslått Enterprise-upgrade");
    expect(editor).toContain("Bruk forslag");
    expect(editor).toContain("Rediger manuelt");
    expect(editor).toContain("Enterprise bygger på samme Varmrett");
    expect(editor).toContain("isEnterpriseUpgradeMode");
    expect(editor).toContain("lp-editor-panel-varmrett");
    expect(editor).toContain("Lunchportalen 5 %");
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

  test("accordion shows all five categories with tier badges and isolate banner", async () => {
    const ProviderMenuCatalogEditor = (await import("@/components/providers/ProviderMenuCatalogEditor")).default;
    const html = renderToStaticMarkup(
      React.createElement(ProviderMenuCatalogEditor, {
        tier: "ENTERPRISE",
        catalog: CATALOG_FIXTURE,
        onCatalogSaved: () => {},
        panelMode: true,
        initialOpenCategoryKey: "paasmurt",
      }),
    );
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
    const ProviderMenuCatalogEditor = (await import("@/components/providers/ProviderMenuCatalogEditor")).default;
    const html = renderToStaticMarkup(
      React.createElement(ProviderMenuCatalogEditor, {
        tier: "BASIS",
        catalog: CATALOG_FIXTURE,
        onCatalogSaved: () => {},
        panelMode: true,
        initialOpenCategoryKey: "paasmurt",
      }),
    );
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
  });
});

describe("LeverandorMenyPage full-width frame", () => {
  test("page uses lean topbar with locale only (no duplicate branding)", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("lp-editor-page");
    expect(source).toContain("lp-editor-topbar");
    expect(source).toContain("LocaleSwitcher");
    expect(source).not.toContain("LP-logo-uten-bakgrunn");
    expect(source).not.toContain("lp-editor-topbar__brand");
    expect(source).not.toContain("lp-editor-topbar__who");
    expect(source).not.toContain("lp-editor-topbar__avatar");
    expect(source).not.toContain("ds-container");
    expect(source).not.toContain('className="ds-h2">Meny</h1>');
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

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

  test("renders command header with shared warm dish package copy", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("lp-editor-command-header");
    expect(html).toContain("lp-editor-package-card");
    expect(html).toContain("Påsmurt · Salatboks · Dagens varmrett");
    expect(html).toContain("Basis + Sushi · Poké · Thai");
    expect(html).toContain("Samme varmrett + ekstra verdi");
    expect(html).toContain("Én felles varmrett per dag");
    expect(html).toContain("Ikke egen produksjonsrett");
  });

  test("renders full-width workspace with planner and inspector", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("lp-editor-layout");
    expect(html).toContain("lp-editor-days");
    expect(html).toContain("lp-editor-inspector");
    expect(html).toContain("lp-editor-cockpit");
    expect(html).toContain("Mandag");
    expect(html).toContain("Velg en dag");
    expect(html).not.toContain("Pad Thai nudler");
  });

  test("day card renders one shared warm dish per day", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("lp-editor-day__hero");
    expect(html).toContain("Dagens varmrett");
    expect(html).toContain("Én felles varmrett");
    expect(html).toContain("Varmrett mangler");
    expect(html).toContain("Legg inn dagens varmrett før denne dagen kan publiseres.");
  });

  test("empty inspector guides shared warm dish vs upgrade", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain('data-state="closed"');
    expect(html).toContain("Klikk varmrett eller valg i ukeplanen");
    expect(html).toContain("is-inspector-idle");
  });

  test("workspace components separated in source", () => {
    const builder = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"), "utf8");
    expect(builder).toContain("resolveSharedVarmrettSlot");
    expect(builder).not.toContain("lp_order_set");
  });

  test("week planner uses shared warm dish read-model", () => {
    const planner = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuWeekPlanner.tsx"), "utf8");
    expect(planner).toContain("SHARED_WARM_DISH_HINT");
    expect(planner).toContain("enterprise-upgrade");
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

describe("LeverandorMenyPage full-width frame", () => {
  test("page uses full-width workspace wrapper not narrow ds-container", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("lp-editor-page");
    expect(source).not.toContain("ds-container");
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

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
    expect(html).toContain("menu-command-header");
    expect(html).toContain("menu-package-card");
    expect(html).toContain("Påsmurt · Salatboks · Dagens varmmrett");
    expect(html).toContain("Basis + Sushi · Poké · Thai");
    expect(html).toContain("Luxus + Enterprise-upgrade");
    expect(html).toContain("Varmretten er felles per dag");
  });

  test("renders full-width workspace with planner and inspector", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("provider-menu-layout");
    expect(html).toContain("provider-menu-days");
    expect(html).toContain("provider-menu-inspector");
    expect(html).toContain("Mandag");
    expect(html).toContain("Velg en dag");
    expect(html).not.toContain("Pad Thai nudler");
  });

  test("day card renders one shared warm dish per day", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("menu-day-card__hero");
    expect(html).toContain("Dagens varmmatrett");
    expect(html).toContain("Samme for alle pakker");
    expect(html).toContain("Pakkeinnhold");
    expect(html).toContain("Basis: Påsmurt · Salatboks");
    expect(html).toContain("Luxus: + Sushi · Poké · Thai");
    expect(html).toContain("Enterprise: + Upgrade");
  });

  test("empty inspector guides shared warm dish vs upgrade", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain('data-state="closed"');
    expect(html).toContain("Klikk på varmmatrett, faste valg eller Enterprise-upgrade");
  });

  test("workspace components separated in source", () => {
    const builder = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"), "utf8");
    expect(builder).toContain("resolveSharedVarmrettSlot");
    expect(builder).not.toContain("lp_order_set");
  });

  test("week planner uses shared warm dish read-model", () => {
    const planner = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuWeekPlanner.tsx"), "utf8");
    expect(planner).toContain("SHARED_WARM_DISH_HINT");
    expect(planner).toContain("DAY_PACKAGE_INCLUDES");
    expect(planner).toContain("enterprise-upgrade");
    expect(planner).not.toContain("ds-provider-menu-day__variant-row");
  });

  test("editor panel separates warm dish from enterprise upgrade", () => {
    const editor = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuEditorPanel.tsx"), "utf8");
    const workspace = readFileSync(resolve(process.cwd(), "lib/provider-menu/providerMenuWorkspace.ts"), "utf8");
    expect(workspace).toContain("felles for alle pakker");
    expect(workspace).toContain("tillegg til dagens varmmrett");
    expect(editor).toContain("ikke en separat varmmrett");
    expect(editor).toContain("isEnterpriseUpgradeMode");
  });
});

describe("LeverandorMenyPage full-width frame", () => {
  test("page uses full-width workspace wrapper not narrow ds-container", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("provider-menu-workspace-page");
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
  test("Basis still three categories", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/provider-menu/providerMenuTierContract.ts"), "utf8");
    expect(source).toContain("categoriesForTierInOrder(PLAN_CATEGORIES.BASIS)");
    expect(source).toContain("Ost & Skinke");
  });
});

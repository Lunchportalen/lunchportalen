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

  test("renders full-width workspace with planner and inspector", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("provider-menu-layout");
    expect(html).toContain("provider-menu-days");
    expect(html).toContain("provider-menu-grid-scroll");
    expect(html).toContain("provider-menu-inspector");
    expect(html).toContain("ds-provider-menu-workspace__inspector");
    expect(html).toContain("Mandag");
    expect(html).toContain("Fredag");
    expect(html).toContain("Velg en dag og kategori");
    expect(html).not.toContain("Pad Thai nudler");
  });

  test("empty inspector state when nothing selected", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain('data-state="closed"');
    expect(html).toContain("Klikk en variant eller varmmatrett");
  });

  test("workspace components separated in source", () => {
    const builder = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"), "utf8");
    expect(builder).toContain("ProviderMenuWeekPlanner");
    expect(builder).toContain("ProviderMenuEditorPanel");
    expect(builder).toContain("ds-provider-menu-workspace__inspector");
    expect(builder).not.toContain("lp_order_set");
  });

  test("week planner uses scroll wrapper not inline grid only", () => {
    const planner = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuWeekPlanner.tsx"), "utf8");
    expect(planner).toContain("provider-menu-grid-scroll");
    expect(planner).toContain("provider-menu-days");
    expect(planner).toContain("ds-provider-menu-day__variant-row");
    expect(planner).not.toContain("ds-provider-menu-builder__grid");
  });

  test("editor panel has Enterprise premium section", () => {
    const editor = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuEditorPanel.tsx"), "utf8");
    expect(editor).toContain("Enterprise-verdi");
    expect(editor).toContain("provider-menu-inspector");
    expect(editor).toContain("enterprise-premium");
    expect(editor).toContain("Bilde er valgfritt");
  });
});

describe("LeverandorMenyPage full-width frame", () => {
  test("page uses full-width workspace wrapper not narrow ds-container", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("provider-menu-workspace-page");
    expect(source).toContain("ds-provider-meny-page");
    expect(source).not.toContain("ds-container");
    expect(source).toContain("ProviderMenuBuilder");
  });

  test("CSS defines full-width page and 5-column days grid", () => {
    const css = readFileSync(resolve(process.cwd(), "app/styles/ds/provider-admin.css"), "utf8");
    expect(css).toContain(".provider-menu-workspace-page");
    expect(css).toContain("max-width: none");
    expect(css).toContain(".provider-menu-layout");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) minmax(360px, 420px)");
    expect(css).toContain(".provider-menu-days");
    expect(css).toContain("grid-template-columns: repeat(5, minmax(220px, 1fr))");
    expect(css).toContain(".provider-menu-grid-scroll");
    expect(css).toContain("overflow-x: auto");
    expect(css).toContain(".provider-menu-inspector");
  });
});

describe("provider menu safety guards", () => {
  const guardedFiles = [
    "components/providers/ProviderMenuBuilder.tsx",
    "components/providers/ProviderMenuEditorPanel.tsx",
    "components/providers/ProviderMenuWeekPlanner.tsx",
    "lib/provider-menu/providerMenuTierContract.ts",
    "app/api/provider/menu-days/route.ts",
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
    expect(source).toContain('categoriesForTierInOrder(PLAN_CATEGORIES.BASIS)');
    expect(source).toContain("Ost & Skinke");
  });
});

describe("order write-path unchanged", () => {
  test("app/api/orders/route.ts untouched", () => {
    const source = readFileSync(resolve(process.cwd(), "app/api/orders/route.ts"), "utf8");
    expect(source).toContain("export async function POST");
    expect(source).not.toContain("provider-menu-layout");
  });
});

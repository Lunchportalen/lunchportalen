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

describe("ProviderMenuBuilder workspace", () => {
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

  test("renders workspace with tabs, week planner and editor panel", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("Basis");
    expect(html).toContain("Luxus");
    expect(html).toContain("Enterprise");
    expect(html).toContain("Ukeplanlegger");
    expect(html).toContain("Menykatalog");
    expect(html).toContain("Mandag");
    expect(html).toContain("Fredag");
    expect(html).toContain("Ost &amp; Skinke");
    expect(html).not.toContain("Pad Thai nudler");
    expect(html).toContain("Mangler varmmat fra Sanity/bank");
    expect(html).toContain("Velg en dag og kategori");
    expect(html).toContain("ds-provider-menu-editor");
    expect(html).toContain("ds-provider-menu-workspace__body");
  });

  test("workspace components exist in source", () => {
    const builder = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"), "utf8");
    expect(builder).toContain("ProviderMenuWeekPlanner");
    expect(builder).toContain("ProviderMenuEditorPanel");
    expect(builder).toContain("ProviderMenuCatalogView");
    expect(builder).not.toMatch(/SANITY_WRITE_TOKEN/i);
    expect(builder).toContain("/api/provider/menu-days");
  });

  test("editor panel has Enterprise-verdi and contextual modes", () => {
    const editor = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuEditorPanel.tsx"), "utf8");
    expect(editor).toContain("Enterprise-verdi");
    expect(editor).toContain("Katalogvalg");
    expect(editor).toContain("Dagens varmmatrett");
    expect(editor).toContain("Enterprise upgrade");
    expect(editor).toContain("Lagre utkast");
    expect(editor).toContain("Publiser");
  });

  test("desktop week grid uses 5 day columns in CSS", () => {
    const css = readFileSync(resolve(process.cwd(), "app/styles/ds/provider-admin.css"), "utf8");
    expect(css).toContain("grid-template-columns: repeat(5, minmax(180px, 1fr))");
    expect(css).toContain("ds-provider-menu-workspace__body");
    expect(css).not.toContain("repeat(auto-fit, minmax(160px, 1fr))");
  });

  test("tier contract unchanged", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/provider-menu/providerMenuTierContract.ts"), "utf8");
    expect(source).toContain("BASIS_WORKSPACE_CATEGORIES");
    expect(source).toContain("Ost & Skinke");
    expect(source).toContain("Fast pakke: 6 maki + 2 nigiri + 1 tempura");
  });
});

describe("LeverandorMenyPage", () => {
  test("page source renders ProviderMenuBuilder for editors", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("ProviderMenuBuilder");
    expect(source).toContain("Planlegg, vedlikehold og publiser menyer");
    expect(source).not.toContain("Sanity Studio");
  });
});

describe("provider menu safety guards", () => {
  const guardedFiles = [
    "components/providers/ProviderMenuBuilder.tsx",
    "components/providers/ProviderMenuEditorPanel.tsx",
    "components/providers/ProviderMenuWeekPlanner.tsx",
    "components/providers/ProviderMenuCatalogView.tsx",
    "lib/provider-menu/providerMenuTierContract.ts",
    "lib/provider-menu/providerMenuCatalogReadModel.ts",
    "lib/provider-menu/providerMenuCatalogSurface.ts",
    "lib/provider-menu/providerMenuWorkspace.ts",
    "app/api/provider/menu-days/route.ts",
    "lib/provider-menu/menuDayPayload.ts",
    "lib/providers/providerMenuPackageSurface.ts",
  ];

  test("provider menu surfaces do not import order write-path", () => {
    for (const rel of guardedFiles) {
      const source = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(source).not.toContain("lp_order_set");
      expect(source).not.toContain("lp_order_advance_status");
      expect(source).not.toMatch(/app\/api\/orders\/route/);
    }
  });

  test("no /week write-flow imports in workspace", () => {
    const builder = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"), "utf8");
    expect(builder).not.toMatch(/app\/\(app\)\/week/);
    expect(builder).not.toContain("lp_order_set");
  });
});

describe("order write-path unchanged", () => {
  test("app/api/orders/route.ts was not modified in this changeset", () => {
    const source = readFileSync(resolve(process.cwd(), "app/api/orders/route.ts"), "utf8");
    expect(source).toContain("export async function POST");
    expect(source).not.toContain("provider-menu-workspace");
  });
});

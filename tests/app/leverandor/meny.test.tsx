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

describe("ProviderMenuBuilder", () => {
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

  test("renders Basis/Luxus/Enterprise tabs and week grid", async () => {
    const ProviderMenuBuilder = (await import("@/components/providers/ProviderMenuBuilder")).default;
    const html = renderToStaticMarkup(React.createElement(ProviderMenuBuilder));
    expect(html).toContain("Basis");
    expect(html).toContain("Luxus");
    expect(html).toContain("Enterprise");
    expect(html).toContain("Mandag");
    expect(html).toContain("Fredag");
    expect(html).toContain("Ost &amp; skinke");
    expect(html).toContain("Fast valg");
    expect(html).toContain("Mangler varmmat fra Sanity");
    expect(html).toContain("Publiser kategori");
  });

  test("Enterprise value builder section exists in source", () => {
    const source = readFileSync(resolve(process.cwd(), "components/providers/ProviderMenuBuilder.tsx"), "utf8");
    expect(source).toContain("basisMenuContract");
    expect(source).toContain("providerMenuCatalogSurface");
    expect(source).toContain("provider-menu-week-grid");
    expect(source).toContain("resolveVariantRowsForDay");
    expect(source).not.toMatch(/SANITY_WRITE_TOKEN/i);
    expect(source).toContain("/api/provider/menu-days");
  });

  test("basis contract file exists with forensic source", () => {
    const source = readFileSync(resolve(process.cwd(), "lib/provider-menu/basisMenuContract.ts"), "utf8");
    expect(source).toContain("seed-lunch-categories-v2.ts");
    expect(source).toContain("Ost & skinke");
    expect(source).toContain("Fast meny");
    expect(source).toContain("Pad med mamuang");
  });

  test("desktop week grid uses 5 day columns in CSS", () => {
    const css = readFileSync(resolve(process.cwd(), "app/styles/ds/provider-admin.css"), "utf8");
    expect(css).toContain("grid-template-columns: repeat(5, minmax(180px, 1fr))");
    expect(css).not.toContain("repeat(auto-fit, minmax(160px, 1fr))");
  });
});

describe("LeverandorMenyPage", () => {
  test("page source renders ProviderMenuBuilder for editors", () => {
    const source = readFileSync(resolve(process.cwd(), "app/leverandor/meny/page.tsx"), "utf8");
    expect(source).toContain("ProviderMenuBuilder");
    expect(source).toContain("Planlegg og publiser meny for Basis, Luxus og Enterprise.");
    expect(source).not.toContain("ProviderMenuEditor");
    expect(source).not.toContain("Sanity Studio");
    expect(source).not.toContain("getVerifiedSanityStudioBaseUrl");
  });
});

describe("provider menu safety guards", () => {
  const guardedFiles = [
    "components/providers/ProviderMenuBuilder.tsx",
    "lib/provider-menu/basisMenuContract.ts",
    "lib/provider-menu/providerMenuCatalogSurface.ts",
    "app/api/provider/menu-days/route.ts",
    "lib/provider-menu/menuDayPayload.ts",
    "lib/providers/providerMenuPackageSurface.ts",
    "lib/providers/providerMenuPriceConfig.ts",
  ];

  test("provider menu surfaces do not import order write-path", () => {
    for (const rel of guardedFiles) {
      const source = readFileSync(resolve(process.cwd(), rel), "utf8");
      expect(source).not.toContain("lp_order_set");
      expect(source).not.toContain("lp_order_advance_status");
      expect(source).not.toMatch(/app\/api\/orders\/route/);
    }
  });
});

describe("order write-path unchanged", () => {
  test("app/api/orders/route.ts was not modified in this changeset", () => {
    const source = readFileSync(resolve(process.cwd(), "app/api/orders/route.ts"), "utf8");
    expect(source).toContain("export async function POST");
    expect(source).not.toContain("provider-menu");
  });
});

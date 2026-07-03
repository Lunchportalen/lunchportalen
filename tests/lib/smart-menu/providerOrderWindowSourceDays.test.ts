import { describe, expect, it, vi, beforeEach } from "vitest";

import { mapPublishedMenuContentsToOrderWindowDays } from "@/lib/smart-menu/providerOrderWindowSourceDays";

describe("SMART-4 — providerOrderWindowSourceDays mapper", () => {
  it("maps published menuDay rows to order-window overlay shape with item.key", () => {
    const days = mapPublishedMenuContentsToOrderWindowDays([
      {
        _id: "menuDay-1",
        date: "2026-07-06",
        planTier: "BASIS",
        category: "varmrett",
        mealTitle: "SMART3 Smoke Original",
        title: "SMART3 Smoke Original",
        description: "Desc",
        allergens: ["Gluten"],
        isPublished: true,
        items: [
          {
            key: "smart3-smoke-item",
            title: "SMART3 Smoke Original",
            description: null,
            allergens: [],
            isVegetarian: false,
            available: true,
          },
        ],
      },
    ]);

    expect(days).toHaveLength(1);
    expect(days[0]?.date).toBe("2026-07-06");
    expect(days[0]?.categories[0]).toMatchObject({
      category: "varmrett",
      key: "varmmat",
      title: "SMART3 Smoke Original",
    });
    expect(days[0]?.categories[0]?.items[0]?.key).toBe("smart3-smoke-item");
  });
});

describe("SMART-4 — loadProviderTranslationSourcesReport wiring", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("merges catalog and order-window candidates with dedupe", async () => {
    vi.doMock("@/lib/cms/lunchCategory", () => ({
      fetchLunchCategoryRowsForProvider: vi.fn(async () => []),
    }));
    vi.doMock("@/lib/provider-menu/providerMenuCatalogReadModel", () => ({
      buildMenuCatalogSnapshot: vi.fn(() => ({ rows: [] })),
    }));
    vi.doMock("@/lib/smart-menu/menuTranslationSources", async () => {
      const actual = await vi.importActual<typeof import("@/lib/smart-menu/menuTranslationSources")>(
        "@/lib/smart-menu/menuTranslationSources",
      );
      return {
        ...actual,
        extractTranslationSourcesFromCatalog: vi.fn(() => [
          {
            provider_id: "p1",
            source_kind: "category_label",
            source_ref: "paasmurt",
            field: "label",
            original_text: "Påsmurt",
            original_text_hash: "h1",
          },
        ]),
        extractTranslationSourcesFromOrderWindowDays: vi.fn(() => [
          {
            provider_id: "p1",
            source_kind: "menu_day",
            source_ref: "2026-07-06:varmrett",
            field: "title",
            original_text: "Varmrett tittel",
            original_text_hash: "h2",
          },
        ]),
      };
    });
    vi.doMock("@/lib/smart-menu/providerOrderWindowSourceDays", () => ({
      loadProviderOrderWindowDaysForTranslationSources: vi.fn(async () => [{ date: "2026-07-06", categories: [] }]),
    }));
    vi.doMock("@/lib/smart-menu/providerTranslationApproval", () => ({
      listProviderMenuTranslations: vi.fn(async () => []),
    }));

    const { loadProviderTranslationSourcesReport } = await import(
      "@/lib/smart-menu/providerTranslationSources"
    );
    const report = await loadProviderTranslationSourcesReport("p1");

    expect(report.sourceTotals.catalog).toBe(1);
    expect(report.sourceTotals.orderWindow).toBe(1);
    expect(report.sourceTotals.combined).toBe(2);
    expect(report.candidateKinds).toContain("menu_day");
    expect(report.candidateKinds).toContain("category_label");
    expect(report.employeeTranslationsLive).toBe(false);
  });
});

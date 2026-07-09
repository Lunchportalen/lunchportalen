import { describe, expect, it } from "vitest";

import { PROD_LUNCH_CATEGORY_FIXTURE } from "../provider-menu/lunchCategoryCatalogFixtures";
import {
  extractTranslationSourcesFromCatalog,
  extractTranslationSourcesFromOrderWindowDays,
  isStableSourceRef,
  mergeTranslationSourceCandidates,
  translationSourceCandidateKey,
} from "@/lib/smart-menu/menuTranslationSources";
import { hashOriginalText } from "@/lib/smart-menu/translationStatus";
import type { OrderWindowDayForOverlay } from "@/lib/smart-menu/employeeApprovedTranslations";

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

describe("SMART-4 — menuTranslationSources", () => {
  it("skips blank and unstable source refs", () => {
    expect(isStableSourceRef("")).toBe(false);
    expect(isStableSourceRef("   ")).toBe(false);
    expect(isStableSourceRef("drafts.lunchCategory-paasmurt")).toBe(false);
    expect(isStableSourceRef("laks-eggerore")).toBe(true);
  });

  it("extracts stable candidates from catalog with runtime-aligned refs", () => {
    const candidates = extractTranslationSourcesFromCatalog(PROVIDER_ID, PROD_LUNCH_CATEGORY_FIXTURE);
    expect(candidates.length).toBeGreaterThan(0);

    const paasmurtItem = candidates.find(
      (c) => c.source_kind === "menu_day_item" && c.source_ref === "laks-eggerore" && c.field === "title",
    );
    expect(paasmurtItem).toMatchObject({
      provider_id: PROVIDER_ID,
      original_text: "Laks & Eggerøre",
    });
    expect(paasmurtItem?.original_text_hash).toBe(hashOriginalText("Laks & Eggerøre"));

    const salatCategory = candidates.find(
      (c) => c.source_kind === "category_label" && c.source_ref === "salat" && c.field === "label",
    );
    expect(salatCategory?.original_text).toBeTruthy();
  });

  it("skips blank original_text and varmrett static catalog rows", () => {
    const candidates = extractTranslationSourcesFromCatalog(PROVIDER_ID, PROD_LUNCH_CATEGORY_FIXTURE);
    expect(candidates.some((c) => c.source_ref === "varmrett")).toBe(false);
    expect(candidates.every((c) => c.original_text.trim().length > 0)).toBe(true);
  });

  it("extracts menu_day sources from order window days", () => {
    const day: OrderWindowDayForOverlay = {
      date: "2026-07-06",
      menuTitle: "Dagens meny",
      categories: [
        {
          key: "varmmat",
          category: "varmrett",
          label: "Varmrett",
          title: "SMART3 Smoke Original",
          description: null,
          allergens: [],
          available: true,
          items: [],
        },
      ],
    };

    const candidates = extractTranslationSourcesFromOrderWindowDays(PROVIDER_ID, [day]);
    expect(
      candidates.some(
        (c) =>
          c.source_kind === "menu_day" &&
          c.source_ref === "2026-07-06:varmrett" &&
          c.field === "title" &&
          c.original_text === "SMART3 Smoke Original",
      ),
    ).toBe(true);
  });

  it("deduplicates merged candidate lists by source key", () => {
    const catalog = extractTranslationSourcesFromCatalog(PROVIDER_ID, PROD_LUNCH_CATEGORY_FIXTURE);
    const merged = mergeTranslationSourceCandidates(catalog, catalog);
    expect(merged.length).toBe(catalog.length);
    const keys = new Set(merged.map((c) => translationSourceCandidateKey(c)));
    expect(keys.size).toBe(merged.length);
  });

  it("deduplicates catalog and order-window lists when same source key appears", () => {
    const shared = {
      provider_id: PROVIDER_ID,
      source_kind: "category_label" as const,
      source_ref: "salat",
      field: "label" as const,
      original_text: "Salat",
      original_text_hash: hashOriginalText("Salat"),
    };
    const merged = mergeTranslationSourceCandidates([shared], [shared]);
    expect(merged).toHaveLength(1);
  });
});

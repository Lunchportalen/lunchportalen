/**
 * SMART-3 — employee approved translation overlay unit tests.
 */
import { describe, expect, test } from "vitest";

import { buildMenuDayCategories } from "@/app/api/order/window/route";
import {
  applyApprovedTranslationsToOrderWindowDays,
  buildTranslationLookupFromRows,
  collectTranslationSourcesFromOrderWindowDay,
  menuDaySourceRef,
  normalizeAllergenSourceRef,
  resolveEmployeeDisplayText,
  sourceRefForMenuDayItem,
  translationLookupKey,
  __testHashOriginalText,
} from "@/lib/smart-menu/employeeApprovedTranslations";

const PROVIDER_ROW_BASE = {
  provider_id: "11111111-1111-1111-1111-111111111111",
  locale: "en",
  approved_by: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  approved_at: "2026-07-01T10:00:00.000Z",
  created_at: "2026-07-01T10:00:00.000Z",
  updated_at: "2026-07-01T10:00:00.000Z",
};

function approvedRow(overrides: Record<string, unknown> = {}) {
  const originalText = String(overrides.original_text ?? "Original");
  const hash = String(overrides.original_text_hash ?? __testHashOriginalText(originalText));
  return {
    id: "33333333-3333-3333-3333-333333333333",
    source_kind: "menu_day_item",
    source_ref: "laks-eggerore",
    field: "title",
    original_text: originalText,
    translated_text: "Translated title",
    status: "approved",
    ...PROVIDER_ROW_BASE,
    ...overrides,
    original_text_hash: hash,
  };
}

describe("employeeApprovedTranslations — visibility", () => {
  test("approved translation with hash match is visible", () => {
    const original = "Påsmurt med ost";
    const row = approvedRow({
      original_text: original,
      translated_text: "Open sandwich with cheese",
      status: "approved",
    });
    const out = resolveEmployeeDisplayText(original, row);
    expect(out.translated).toBe(true);
    expect(out.displayText).toBe("Open sandwich with cheese");
  });

  test.each(["draft", "suggested", "rejected", "stale", "missing"] as const)(
    "%s is not visible — fallback to original",
    (status) => {
      const original = "Dagens rett";
      const row = approvedRow({ original_text: original, status });
      const out = resolveEmployeeDisplayText(original, row);
      expect(out.translated).toBe(false);
      expect(out.displayText).toBe(original);
    },
  );

  test("approved but hash mismatch falls back to original", () => {
    const original = "Ny tittel";
    const row = approvedRow({
      original_text: "Gammel tittel",
      original_text_hash: __testHashOriginalText("Gammel tittel"),
      translated_text: "Old translated",
      status: "approved",
    });
    const out = resolveEmployeeDisplayText(original, row);
    expect(out.translated).toBe(false);
    expect(out.displayText).toBe(original);
  });

  test("approved blank translated_text falls back to original", () => {
    const original = "Tittel";
    const row = approvedRow({ original_text: original, translated_text: "  ", status: "approved" });
    const out = resolveEmployeeDisplayText(original, row);
    expect(out.translated).toBe(false);
    expect(out.displayText).toBe(original);
  });

  test("missing row falls back to original", () => {
    const out = resolveEmployeeDisplayText("Original", null);
    expect(out).toEqual({ displayText: "Original", translated: false });
  });
});

describe("employeeApprovedTranslations — order window overlay", () => {
  function sampleDay() {
    const categories = buildMenuDayCategories({
      planTier: "BASIS",
      menus: [
        {
          category: "varmrett",
          mealTitle: "Biff gryte",
          description: "Dagens varmrett",
          allergens: ["melk"],
          items: [
            {
              key: "laks-eggerore",
              title: "Laks & Eggerøre",
              description: "Med sitron",
              allergens: ["fisk"],
              isVegetarian: false,
              available: true,
            },
          ],
        },
      ],
    });
    return {
      date: "2026-07-07",
      menuTitle: "Ukedag header",
      menuDescription: "Header beskrivelse",
      allergens: ["egg"],
      categories,
    };
  }

  test("collects stable source refs from day payload", () => {
    const day = sampleDay();
    const sources = collectTranslationSourcesFromOrderWindowDay(day);
    expect(sources.some((s) => s.sourceKind === "menu_day_item" && s.sourceRef === "laks-eggerore")).toBe(
      true,
    );
    expect(
      sources.some(
        (s) =>
          s.sourceKind === "menu_day" &&
          s.sourceRef === menuDaySourceRef("2026-07-07", "varmrett") &&
          s.field === "title",
      ),
    ).toBe(true);
    expect(
      sources.some(
        (s) => s.sourceKind === "category_label" && s.sourceRef === "varmrett" && s.field === "label",
      ),
    ).toBe(true);
    expect(
      sources.some(
        (s) =>
          s.sourceKind === "allergen_label" &&
          s.sourceRef === normalizeAllergenSourceRef("melk") &&
          s.field === "label",
      ),
    ).toBe(true);
  });

  test("apply overlay changes display title only — keys unchanged", () => {
    const day = sampleDay();
    const sources = collectTranslationSourcesFromOrderWindowDay(day);
    const itemSource = sources.find(
      (s) => s.sourceKind === "menu_day_item" && s.sourceRef === sourceRefForMenuDayItem("laks-eggerore"),
    )!;
    const rows = [
      approvedRow({
        source_kind: "menu_day_item",
        source_ref: itemSource.sourceRef,
        field: "title",
        original_text: itemSource.originalText,
        translated_text: "Salmon & scrambled eggs",
        status: "approved",
      }),
    ];
    const lookup = buildTranslationLookupFromRows(sources, rows);
    const [out] = applyApprovedTranslationsToOrderWindowDays([day], lookup);
    const varmrett = out.categories.find((c) => c.category === "varmrett");
    const item = varmrett?.items.find((i) => i.key === "laks-eggerore");
    expect(item?.title).toBe("Salmon & scrambled eggs");
    expect(item?.key).toBe("laks-eggerore");
    expect(varmrett?.key).toBe("varmmat");
    expect(varmrett?.category).toBe("varmrett");
    expect(out.date).toBe("2026-07-07");
  });

  test("wrong locale row is ignored when not in lookup sources match", () => {
    const day = sampleDay();
    const sources = collectTranslationSourcesFromOrderWindowDay(day);
    const lookup = buildTranslationLookupFromRows(sources, []);
    const [out] = applyApprovedTranslationsToOrderWindowDays([day], lookup);
    const varmrett = out.categories.find((c) => c.category === "varmrett");
    const item = varmrett?.items.find((i) => i.key === "laks-eggerore");
    expect(item?.title).toBe("Laks & Eggerøre");
  });

  test("lookup key is stable", () => {
    expect(
      translationLookupKey({
        sourceKind: "menu_day_item",
        sourceRef: "laks-eggerore",
        field: "title",
      }),
    ).toContain("menu_day_item");
  });
});

describe("employeeApprovedTranslations — metadata not in overlay DTO", () => {
  test("overlay result exposes only displayText and translated flag", () => {
    const out = resolveEmployeeDisplayText("A", approvedRow({ original_text: "A" }));
    expect(Object.keys(out).sort()).toEqual(["displayText", "translated"]);
  });
});

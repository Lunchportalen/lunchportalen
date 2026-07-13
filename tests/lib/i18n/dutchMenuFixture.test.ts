/**
 * 21-locale completion — Dutch menu fixture integrity (nl-NL, nl-BE).
 * Verifies the provider-approval model: approved rows are real Dutch (not the Norwegian
 * original, not raw keys), machine drafts never carry approved status, and DB canonical
 * values are not translated.
 */
import { describe, expect, it } from "vitest";
import fixture from "../../_fixtures/menu-nl-approved.json";

const DUTCH_MARKETS = ["nl-NL", "nl-BE"] as const;
const VALID_STATUS = new Set(["missing", "draft", "suggested", "approved", "rejected", "stale"]);

describe("Dutch menu fixture (nl-NL, nl-BE)", () => {
  it("covers both Dutch market locales", () => {
    for (const m of DUTCH_MARKETS) {
      expect(Array.isArray((fixture.translations as Record<string, unknown[]>)[m])).toBe(true);
      expect((fixture.translations as Record<string, unknown[]>)[m].length).toBeGreaterThan(0);
    }
  });

  it("approved rows are actual Dutch text, never the Norwegian original or a raw key", () => {
    const originals = new Set(Object.values(fixture.sourceOriginals));
    for (const m of DUTCH_MARKETS) {
      for (const row of (fixture.translations as any)[m] as any[]) {
        expect(VALID_STATUS.has(row.status)).toBe(true);
        expect(row.locale).toBe("nl");
        if (row.status === "approved") {
          expect(row.text.trim().length).toBeGreaterThan(0);
          expect(row.text).not.toMatch(/[{}]/); // no raw interpolation/keys
          expect(row.text).not.toMatch(/\u00C3|\u00E2\u20AC/); // no mojibake
          // Dish names (menu_day_item) must be genuinely translated, not the Norwegian original.
          // Allergen labels may legitimately be cross-language cognates (e.g. "Melk" = milk in both nb and nl).
          if (row.source_kind === "menu_day_item") {
            expect(originals.has(row.text), `dish title must be translated Dutch, not Norwegian original: ${row.text}`).toBe(false);
          }
        }
      }
    }
  });

  it("machine drafts are never marked approved", () => {
    for (const m of DUTCH_MARKETS) {
      for (const row of (fixture.translations as any)[m] as any[]) {
        if (typeof row.text === "string" && /machinevertaling|machine/i.test(row.text)) {
          expect(row.status).not.toBe("approved");
        }
      }
    }
  });

  it("required menu system dimensions are covered per Dutch market", () => {
    for (const m of DUTCH_MARKETS) {
      const kinds = new Set(((fixture.translations as any)[m] as any[]).map((r) => r.source_kind));
      expect(kinds.has("menu_day_item")).toBe(true); // dish name
      expect(kinds.has("category_label")).toBe(true); // category
      expect(kinds.has("allergen_label")).toBe(true); // allergen
    }
  });

  it("nl-NL and nl-BE may legitimately differ (regional variant of same base language)", () => {
    const nlNL = ((fixture.translations as any)["nl-NL"] as any[]).find((r) => r.source_ref === "varmrett");
    const nlBE = ((fixture.translations as any)["nl-BE"] as any[]).find((r) => r.source_ref === "varmrett");
    expect(nlNL.text).not.toBe(nlBE.text); // "Warm gerecht van de dag" vs Flemish "Dagschotel"
  });

  it("review status is honestly marked pending, not falsely complete", () => {
    expect((fixture as any)._meta.reviewStatus).toBe("NATIVE_REVIEW_PENDING");
  });
});

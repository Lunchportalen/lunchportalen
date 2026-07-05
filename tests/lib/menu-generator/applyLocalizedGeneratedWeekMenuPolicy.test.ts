import { describe, expect, it } from "vitest";

import { parseApplyLocalizedGeneratedWeekMenuBody } from "@/lib/menu-generator/applyLocalizedGeneratedWeekMenuBody";

describe("parseApplyLocalizedGeneratedWeekMenuBody", () => {
  it("defaults to create_missing_only_strict when overwriteMode omitted", () => {
    const parsed = parseApplyLocalizedGeneratedWeekMenuBody({
      weekStart: "2031-03-31",
      dryRun: true,
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.input.overwriteMode).toBe("create_missing_only_strict");
    }
  });

  it("accepts replace_catalog_with_confirmation and confirmation fields", () => {
    const parsed = parseApplyLocalizedGeneratedWeekMenuBody({
      weekStart: "2031-03-31",
      overwriteMode: "replace_catalog_with_confirmation",
      dryRun: false,
      catalogUpdateConfirmationToken: "abc123",
      replaceCatalogConfirmationPhrase: "Jeg forstår at dette oppdaterer eksisterende katalogvalg",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.input.overwriteMode).toBe("replace_catalog_with_confirmation");
      expect(parsed.input.catalogUpdateConfirmationToken).toBe("abc123");
    }
  });
});

import { describe, expect, it } from "vitest";

import {
  EMPLOYEE_VISIBLE_TRANSLATION_STATUS,
  employeeTranslationDisplayFallback,
  hashOriginalText,
  isEmployeeVisibleTranslation,
  isNonEmployeeVisibleStatus,
  MENU_CONTENT_TRANSLATION_STATUSES,
  normalizeOriginalTextForHash,
  originalTextHashMatches,
} from "@/lib/smart-menu/translationStatus";

describe("SMART-1 — translationStatus pure helpers", () => {
  it("normalizes original text with NFC trim", () => {
    expect(normalizeOriginalTextForHash("  Påsmurt  ")).toBe("Påsmurt");
  });

  it("hashOriginalText is stable for same normalized input", () => {
    const a = hashOriginalText("Påsmurt");
    const b = hashOriginalText("  Påsmurt  ");
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("originalTextHashMatches detects stale originals", () => {
    const hash = hashOriginalText("Original tittel");
    expect(originalTextHashMatches(hash, "Original tittel")).toBe(true);
    expect(originalTextHashMatches(hash, "Endret tittel")).toBe(false);
  });

  it("only approved + hash match is employee-visible", () => {
    expect(isEmployeeVisibleTranslation("approved", true)).toBe(true);
    expect(isEmployeeVisibleTranslation("approved", false)).toBe(false);
    for (const status of MENU_CONTENT_TRANSLATION_STATUSES) {
      if (status === EMPLOYEE_VISIBLE_TRANSLATION_STATUS) continue;
      expect(isEmployeeVisibleTranslation(status, true)).toBe(false);
    }
  });

  it("non-employee-visible statuses include draft/suggested/rejected/stale/missing", () => {
    expect(isNonEmployeeVisibleStatus("draft")).toBe(true);
    expect(isNonEmployeeVisibleStatus("suggested")).toBe(true);
    expect(isNonEmployeeVisibleStatus("rejected")).toBe(true);
    expect(isNonEmployeeVisibleStatus("stale")).toBe(true);
    expect(isNonEmployeeVisibleStatus("missing")).toBe(true);
    expect(isNonEmployeeVisibleStatus("approved")).toBe(false);
  });

  it("employee fallback contract is original provider text", () => {
    expect(employeeTranslationDisplayFallback()).toBe("original_provider_text");
  });
});

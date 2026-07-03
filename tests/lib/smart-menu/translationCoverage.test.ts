import { describe, expect, it } from "vitest";

import {
  computeTranslationCoverage,
  listCandidatesMissingTranslation,
  listCandidatesWithStaleLocale,
} from "@/lib/smart-menu/translationCoverage";
import type { MenuTranslationSourceCandidate } from "@/lib/smart-menu/menuTranslationSources";
import { hashOriginalText } from "@/lib/smart-menu/translationStatus";
import type { ProviderMenuTranslationDto } from "@/lib/smart-menu/providerTranslationApproval";

const PROVIDER_ID = "11111111-1111-1111-1111-111111111111";

function candidate(
  sourceRef: string,
  originalText: string,
  sourceKind: MenuTranslationSourceCandidate["source_kind"] = "menu_day_item",
  field: MenuTranslationSourceCandidate["field"] = "title",
): MenuTranslationSourceCandidate {
  return {
    provider_id: PROVIDER_ID,
    source_kind: sourceKind,
    source_ref: sourceRef,
    field,
    original_text: originalText,
    original_text_hash: hashOriginalText(originalText),
  };
}

function row(
  partial: Partial<ProviderMenuTranslationDto> & Pick<ProviderMenuTranslationDto, "sourceRef" | "locale">,
): ProviderMenuTranslationDto {
  const originalText = partial.originalText ?? "Original";
  return {
    id: partial.id ?? "row-1",
    sourceKind: partial.sourceKind ?? "menu_day_item",
    sourceRef: partial.sourceRef,
    field: partial.field ?? "title",
    locale: partial.locale,
    originalText,
    originalTextHash: partial.originalTextHash ?? hashOriginalText(originalText),
    translatedText: partial.translatedText ?? null,
    status: partial.status ?? "draft",
    approvedAt: partial.approvedAt ?? null,
    updatedAt: partial.updatedAt ?? "2026-07-01T00:00:00.000Z",
    hashMatches: partial.hashMatches ?? true,
    employeeVisible: false,
  };
}

describe("SMART-4 — translationCoverage", () => {
  const candidates = [candidate("laks-eggerore", "Laks & Eggerøre")];
  const locales = ["en"] as const;

  it("counts approved + hash match + non-empty translated_text as employee-visible", () => {
    const report = computeTranslationCoverage({
      candidates,
      rows: [
        row({
          id: "approved-en",
          sourceRef: "laks-eggerore",
          locale: "en",
          status: "approved",
          originalText: "Laks & Eggerøre",
          translatedText: "Salmon & scrambled eggs",
        }),
      ],
      locales: [...locales],
    });

    expect(report.locales[0].employeeVisible).toBe(1);
    expect(report.locales[0].coveragePercent).toBe(100);
    expect(report.candidates[0].perLocale[0].employeeVisible).toBe(true);
  });

  it("does not count draft/suggested/rejected as visible", () => {
    for (const status of ["draft", "suggested", "rejected"] as const) {
      const report = computeTranslationCoverage({
        candidates,
        rows: [
          row({
            sourceRef: "laks-eggerore",
            locale: "en",
            status,
            translatedText: "Text",
          }),
        ],
        locales: [...locales],
      });
      expect(report.locales[0].employeeVisible).toBe(0);
      expect(report.candidates[0].perLocale[0].status).toBe(status);
    }
  });

  it("treats hash mismatch as stale/not visible", () => {
    const report = computeTranslationCoverage({
      candidates,
      rows: [
        row({
          sourceRef: "laks-eggerore",
          locale: "en",
          status: "approved",
          originalText: "Old text",
          translatedText: "Translated",
        }),
      ],
      locales: [...locales],
    });

    expect(report.locales[0].employeeVisible).toBe(0);
    expect(report.locales[0].stale).toBe(1);
    expect(report.candidates[0].perLocale[0].status).toBe("stale");
  });

  it("reports missing when no row exists for locale", () => {
    const report = computeTranslationCoverage({
      candidates,
      rows: [],
      locales: [...locales],
    });
    expect(report.locales[0].missing).toBe(1);
    expect(listCandidatesMissingTranslation(report).length).toBe(1);
  });

  it("blank translated_text on approved row is not employee-visible", () => {
    const report = computeTranslationCoverage({
      candidates,
      rows: [
        row({
          sourceRef: "laks-eggerore",
          locale: "en",
          status: "approved",
          originalText: "Laks & Eggerøre",
          translatedText: "   ",
        }),
      ],
      locales: [...locales],
    });
    expect(report.locales[0].employeeVisible).toBe(0);
    expect(report.candidates[0].perLocale[0].status).toBe("blank_translated");
  });

  it("wrong locale row does not count toward target locale coverage", () => {
    const report = computeTranslationCoverage({
      candidates,
      rows: [
        row({
          sourceRef: "laks-eggerore",
          locale: "de",
          status: "approved",
          translatedText: "German text",
        }),
      ],
      locales: [...locales],
    });
    expect(report.locales[0].missing).toBe(1);
    expect(report.locales[0].employeeVisible).toBe(0);
  });

  it("lists stale candidates separately", () => {
    const report = computeTranslationCoverage({
      candidates,
      rows: [
        row({
          sourceRef: "laks-eggerore",
          locale: "en",
          status: "stale",
          translatedText: "Old translation",
        }),
      ],
      locales: [...locales],
    });
    expect(listCandidatesWithStaleLocale(report).length).toBe(1);
  });
});

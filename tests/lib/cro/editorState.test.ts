/**
 * CRO editor state: parse, merge, dismiss. Reject leaves content unchanged.
 */
import { describe, test, expect } from "vitest";
import {
  parseCroRecommendationsFromMeta,
  dismissCroSuggestionInMeta,
  mergeCroRecommendationsIntoMeta,
} from "@/lib/cro/editorState";
import type { CroSuggestion } from "@/lib/cro/suggestions";

describe("dismissCroSuggestionInMeta", () => {
  test("reject leaves content unchanged: only suggestion status updated, meta.cro and other keys untouched", () => {
    const meta = {
      seo: { title: "Original title", description: "Original desc" },
      cro: { trustSignals: ["Sikkerhet"], primaryCta: "Be om demo" },
      intent: { intent: "convert" },
      croRecommendations: {
        lastRunAt: "2025-01-01T00:00:00Z",
        score: 60,
        suggestions: [
          {
            id: "rec_1",
            type: "no_trust_signals",
            category: "trust",
            target: "page",
            targetBlockId: "",
            label: "Tillit",
            before: "None",
            recommendedChange: "Set",
            rationale: "Why",
            priority: "medium",
            severity: "warn",
            status: "pending",
          },
        ],
      },
    };
    const rec = { id: "rec_1" };
    const next = dismissCroSuggestionInMeta(meta as Record<string, unknown>, rec);

    expect(next.seo).toEqual(meta.seo);
    expect(next.cro).toEqual(meta.cro);
    expect(next.intent).toEqual(meta.intent);
    expect((next.croRecommendations as { suggestions: { id: string; status: string }[] }).suggestions[0].status).toBe("dismissed");
  });

  test("dismiss with missing croRecommendations returns meta unchanged (no throw)", () => {
    const meta = { cro: { trustSignals: ["A"] } };
    const next = dismissCroSuggestionInMeta(meta as Record<string, unknown>, { id: "nonexistent" });
    expect(next).toEqual(meta);
  });
});

describe("parseCroRecommendationsFromMeta", () => {
  test("null or non-object meta returns null", () => {
    expect(parseCroRecommendationsFromMeta(null)).toBeNull();
    expect(parseCroRecommendationsFromMeta(undefined)).toBeNull();
    expect(parseCroRecommendationsFromMeta([])).toBeNull();
  });

  test("meta without croRecommendations returns null", () => {
    expect(parseCroRecommendationsFromMeta({})).toBeNull();
    expect(parseCroRecommendationsFromMeta({ cro: {} })).toBeNull();
  });
});

describe("mergeCroRecommendationsIntoMeta", () => {
  test("merge preserves applied and dismissed status by key", () => {
    const existing = parseCroRecommendationsFromMeta({
      croRecommendations: {
        lastRunAt: "old",
        score: 50,
        suggestions: [
          {
            id: "id1",
            type: "no_trust_signals",
            target: "page",
            targetBlockId: "",
            status: "dismissed",
            label: "T",
            before: "",
            recommendedChange: "Set",
            rationale: "",
            category: "trust",
            priority: "medium",
            severity: "warn",
          },
        ],
      },
    });
    const suggestion: CroSuggestion = {
      type: "no_trust_signals",
      category: "trust",
      target: "page",
      targetBlockId: "",
      label: "Tillit",
      before: "None",
      recommendedChange: "Set",
      rationale: "Why",
      priority: "medium",
      severity: "warn",
    };
    const meta = { cro: {} };
    const next = mergeCroRecommendationsIntoMeta(
      meta as Record<string, unknown>,
      { score: 70, suggestions: [suggestion] },
      existing
    );
    const state = next.croRecommendations as { suggestions: { status: string }[] };
    expect(state.suggestions[0].status).toBe("dismissed");
  });
});

/**
 * SEO suggestion engine: structured output, explanation, invalid-output safety.
 */
import { describe, test, expect } from "vitest";
import { buildSeoSuggestions, normalizeSeoSuggestionItem } from "@/lib/seo/suggestions";
import type { PageSeoAnalysis } from "@/lib/seo/pageAnalysis";

function analysis(overrides: Partial<PageSeoAnalysis> = {}): PageSeoAnalysis {
  return {
    title: "",
    description: "",
    headings: [],
    firstHeading: "",
    bodyContent: "",
    bodyWordCount: 0,
    hasInternalLinks: false,
    internalLinkCount: 0,
    imageAlts: [],
    hasFaq: false,
    hasCta: false,
    ctaButtonLabel: "",
    ctaTitle: "",
    blocksAnalyzed: 0,
    ...overrides,
  };
}

describe("buildSeoSuggestions", () => {
  test("returns structured suggestions with type, suggested change, and explanation", () => {
    const { suggestions, totalDeduction } = buildSeoSuggestions(
      analysis({ blocksAnalyzed: 1 }),
      { locale: "nb", brand: "LP", goal: "lead", pageTitle: "Side" }
    );
    expect(suggestions.length).toBeGreaterThan(0);
    for (const s of suggestions) {
      expect(s.type).toBeDefined();
      expect(typeof s.suggested).toBe("string");
      expect(typeof s.explanation).toBe("string");
      expect(s.explanation.length).toBeGreaterThan(0);
    }
    expect(totalDeduction).toBeGreaterThan(0);
  });

  test("title suggestion includes explanation referencing page context", () => {
    const { suggestions } = buildSeoSuggestions(
      analysis({ title: "", blocksAnalyzed: 1 }),
      { locale: "nb", brand: "LP", goal: "lead", pageTitle: "Min side" }
    );
    const titleSuggestion = suggestions.find((s) => s.type === "title_improvement");
    expect(titleSuggestion).toBeDefined();
    expect(titleSuggestion!.suggested).toContain("Min side");
    expect(titleSuggestion!.explanation).toMatch(/søk|tittel|SEO/i);
  });

  test("keyword_topic suggestion when primaryKeyword empty and page has heading", () => {
    const { suggestions } = buildSeoSuggestions(
      analysis({ firstHeading: "Firmalunsj med kontroll", blocksAnalyzed: 2 }),
      { locale: "nb", brand: "LP", goal: "lead", pageTitle: "Forside", primaryKeyword: "" }
    );
    const kw = suggestions.find((s) => s.type === "keyword_topic");
    expect(kw).toBeDefined();
    expect(kw!.suggested).toBe("Firmalunsj med kontroll");
    expect(kw!.explanation).toMatch(/Hovednøkkelord|AI & mål/i);
  });

  test("no keyword_topic when primaryKeyword already set", () => {
    const { suggestions } = buildSeoSuggestions(
      analysis({ firstHeading: "Firmalunsj", blocksAnalyzed: 1 }),
      { locale: "nb", brand: "LP", goal: "lead", pageTitle: "P", primaryKeyword: "firmalunsj" }
    );
    expect(suggestions.some((s) => s.type === "keyword_topic")).toBe(false);
  });
});

describe("normalizeSeoSuggestionItem", () => {
  test("returns null for non-object or array", () => {
    expect(normalizeSeoSuggestionItem(null)).toBeNull();
    expect(normalizeSeoSuggestionItem(undefined)).toBeNull();
    expect(normalizeSeoSuggestionItem([])).toBeNull();
    expect(normalizeSeoSuggestionItem("x")).toBeNull();
  });

  test("returns null for invalid type", () => {
    expect(
      normalizeSeoSuggestionItem({ type: "invalid_type", suggested: "x", label: "L" })
    ).toBeNull();
  });

  test("returns safe shape for valid input", () => {
    const out = normalizeSeoSuggestionItem({
      type: "title_improvement",
      label: "SEO-tittel",
      before: "Old",
      suggested: "New title",
      explanation: "Improves clicks.",
      priority: "high",
    });
    expect(out).not.toBeNull();
    expect(out!.type).toBe("title_improvement");
    expect(out!.suggested).toBe("New title");
    expect(out!.explanation).toBe("Improves clicks.");
  });

  test("defaults missing fields for valid type", () => {
    const out = normalizeSeoSuggestionItem({
      type: "heading_hierarchy",
      suggested: "Short",
    });
    expect(out).not.toBeNull();
    expect(out!.label).toBe("heading_hierarchy");
    expect(out!.before).toBe("");
    expect(out!.explanation).toBe("");
    expect(out!.priority).toBe("medium");
  });
});

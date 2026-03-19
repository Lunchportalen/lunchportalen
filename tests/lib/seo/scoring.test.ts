/**
 * SEO scoring engine: deterministic score, breakdown, fail-safe.
 */
import { describe, test, expect } from "vitest";
import {
  computeSeoScore,
  failSafeSeoScore,
  SEO_SCORE_CONSTANTS,
  type SeoScoreBreakdown,
} from "@/lib/seo/scoring";
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

describe("computeSeoScore", () => {
  test("returns score 0–100 and breakdown with all categories", () => {
    const result = computeSeoScore({
      analysis: analysis({ title: "Good title here", description: "A nice description.", blocksAnalyzed: 1 }),
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.totalDeduction).toBeGreaterThanOrEqual(0);
    const keys: (keyof SeoScoreBreakdown)[] = [
      "title",
      "description",
      "heading",
      "contentDepth",
      "imageAlt",
      "internalLinks",
      "faq",
      "cta",
      "weakCta",
      "keywordRelevance",
    ];
    for (const k of keys) {
      expect(result.breakdown).toHaveProperty(k);
      expect(typeof result.breakdown[k]).toBe("number");
    }
  });

  test("is deterministic: same input yields same score", () => {
    const a = analysis({
      title: "Firmalunsj – bestill enkelt",
      description: "Vi leverer lunsj til arbeidsplassen.",
      firstHeading: "Slik bestiller du",
      bodyWordCount: 80,
      blocksAnalyzed: 2,
      hasInternalLinks: true,
      hasFaq: true,
      hasCta: true,
      ctaButtonLabel: "Be om tilbud",
      ctaTitle: "Kontakt oss",
      imageAlts: [
        { blockId: "img1", alt: "Alt 1", empty: false },
        { blockId: "img2", alt: "Alt 2", empty: false },
      ],
    });
    const r1 = computeSeoScore({ analysis: a });
    const r2 = computeSeoScore({ analysis: a });
    expect(r1.score).toBe(r2.score);
    expect(r1.totalDeduction).toBe(r2.totalDeduction);
    expect(r1.breakdown).toEqual(r2.breakdown);
  });

  test("content depth: deduction when bodyWordCount < MIN and blocksAnalyzed >= 1", () => {
    const thin = analysis({ blocksAnalyzed: 1, bodyWordCount: 30 });
    const result = computeSeoScore({ analysis: thin });
    expect(result.breakdown.contentDepth).toBe(SEO_SCORE_CONSTANTS.CONTENT_DEPTH_DEDUCTION);
  });

  test("content depth: no deduction when body word count >= MIN", () => {
    const ok = analysis({ blocksAnalyzed: 1, bodyWordCount: 60 });
    const result = computeSeoScore({ analysis: ok });
    expect(result.breakdown.contentDepth).toBe(0);
  });

  test("keyword relevance: deduction when primaryKeyword set but not in title or firstHeading", () => {
    const a = analysis({
      title: "Lunch til bedriften",
      firstHeading: "Bestill lunsj",
      blocksAnalyzed: 1,
    });
    const result = computeSeoScore({ analysis: a, primaryKeyword: "firmalunsj" });
    expect(result.breakdown.keywordRelevance).toBe(SEO_SCORE_CONSTANTS.KEYWORD_RELEVANCE_DEDUCTION);
  });

  test("keyword relevance: no deduction when primaryKeyword in title", () => {
    const a = analysis({
      title: "Firmalunsj – enkelt og raskt",
      firstHeading: "Bestill",
      blocksAnalyzed: 1,
    });
    const result = computeSeoScore({ analysis: a, primaryKeyword: "firmalunsj" });
    expect(result.breakdown.keywordRelevance).toBe(0);
  });

  test("keyword relevance: no deduction when primaryKeyword empty", () => {
    const a = analysis({ blocksAnalyzed: 1 });
    const result = computeSeoScore({ analysis: a, primaryKeyword: "" });
    expect(result.breakdown.keywordRelevance).toBe(0);
  });

  test("fail-safe: null analysis returns score 0 and empty breakdown", () => {
    const result = computeSeoScore({ analysis: null });
    expect(result.score).toBe(0);
    expect(result.totalDeduction).toBe(100);
    expect(result.breakdown.title).toBe(0);
    expect(result.breakdown.description).toBe(0);
  });

  test("fail-safe: undefined analysis returns score 0", () => {
    const result = computeSeoScore({ analysis: undefined });
    expect(result.score).toBe(0);
    expect(result.totalDeduction).toBe(100);
  });

  test("failSafeSeoScore() returns same shape as fail path", () => {
    const result = failSafeSeoScore();
    expect(result.score).toBe(0);
    expect(result.totalDeduction).toBe(100);
    expect(Object.keys(result.breakdown).length).toBeGreaterThan(0);
  });
});

/**
 * SEO intelligence: computeSeoIntelligence structured result, parse/merge persistence, malformed safety.
 * Deterministic tests only; no snapshots.
 */
import { describe, test, expect } from "vitest";
import {
  computeSeoIntelligence,
  parseSeoRecommendationsFromMeta,
  mergeSeoRecommendationsIntoMeta,
  applySeoRecommendationToMeta,
  dismissSeoRecommendationInMeta,
  type SeoIntelligenceResult,
  type SeoRecommendation,
  type SeoRecommendationsState,
} from "@/lib/seo/intelligence";

describe("computeSeoIntelligence", () => {
  test("returns structured result with score 0–100, suggestions array, message, and breakdown", () => {
    const result = computeSeoIntelligence({
      blocks: [{ id: "b1", type: "richText", data: { body: "Intro text." } }],
      meta: { seo: { title: "Short", description: "" } },
      pageTitle: "Page",
      locale: "nb",
      goal: "lead",
      brand: "LP",
    });
    expect(typeof result.score).toBe("number");
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(typeof result.message).toBe("string");
    expect(result.message).toMatch(/Score:|score/i);
    expect(result.breakdown).toBeDefined();
    expect(typeof result.breakdown?.title).toBe("number");
  });

  test("each suggestion has id, type, label, before, suggested, explanation, priority, status", () => {
    const result = computeSeoIntelligence({
      blocks: [{ id: "b1", type: "richText", data: {} }],
      meta: {},
      pageTitle: "T",
      locale: "nb",
    });
    expect(result.suggestions.length).toBeGreaterThan(0);
    for (const s of result.suggestions) {
      expect(typeof s.id).toBe("string");
      expect(s.id.length).toBeGreaterThan(0);
      expect(typeof s.type).toBe("string");
      expect(typeof s.label).toBe("string");
      expect(typeof s.before).toBe("string");
      expect(typeof s.suggested).toBe("string");
      expect(typeof s.explanation).toBe("string");
      expect(["high", "medium", "low"]).toContain(s.priority);
      expect(["pending", "applied", "dismissed"]).toContain(s.status);
    }
  });

  test("title and description suggestions have metaField seo.title or seo.description", () => {
    const result = computeSeoIntelligence({
      blocks: [{ id: "b1", type: "richText", data: {} }],
      meta: {},
      pageTitle: "Page",
      locale: "nb",
    });
    const titleSuggestion = result.suggestions.find((s) => s.type === "title_improvement");
    const descSuggestion = result.suggestions.find((s) => s.type === "meta_description_improvement");
    if (titleSuggestion) expect(titleSuggestion.metaField).toBe("seo.title");
    if (descSuggestion) expect(descSuggestion.metaField).toBe("seo.description");
  });

  test("score is lower when title and description missing", () => {
    const poor = computeSeoIntelligence({
      blocks: [{ id: "b1", type: "richText", data: {} }],
      meta: {},
      pageTitle: "P",
      locale: "nb",
    });
    const good = computeSeoIntelligence({
      blocks: [
        { id: "b1", type: "richText", data: { heading: "H", body: "Enough body content here to pass the minimum word count for content depth." } },
        { id: "b2", type: "cta", data: { title: "Kontakt", buttonLabel: "Be om tilbud" } },
      ],
      meta: {
        seo: {
          title: "Firmalunsj – bestill enkelt og raskt hos Lunchportalen",
          description: "Vi leverer lunsj til arbeidsplassen. Bestill enkelt, få levert på tid. Spør om demo eller ta kontakt for mer informasjon om våre tjenester.",
        },
      },
      pageTitle: "P",
      locale: "nb",
    });
    expect(good.score).toBeGreaterThan(poor.score);
  });

  test("malformed input does not throw: empty blocks and meta yield deterministic result", () => {
    const result = computeSeoIntelligence({
      blocks: [],
      meta: undefined,
      pageTitle: "Fallback",
      locale: "nb",
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(typeof result.message).toBe("string");
  });

  test("malformed blocks (non-array at runtime) does not throw", () => {
    const result = computeSeoIntelligence({
      blocks: null as unknown as Array<{ id: string; type: string; data?: Record<string, unknown> }>,
      meta: {},
      pageTitle: "P",
      locale: "nb",
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.suggestions)).toBe(true);
  });
});

describe("parseSeoRecommendationsFromMeta", () => {
  test("returns null for null or non-object meta", () => {
    expect(parseSeoRecommendationsFromMeta(null)).toBeNull();
    expect(parseSeoRecommendationsFromMeta(undefined)).toBeNull();
    expect(parseSeoRecommendationsFromMeta([])).toBeNull();
    expect(parseSeoRecommendationsFromMeta("x")).toBeNull();
  });

  test("returns null when seoRecommendations missing or not object", () => {
    expect(parseSeoRecommendationsFromMeta({})).toBeNull();
    expect(parseSeoRecommendationsFromMeta({ seoRecommendations: null })).toBeNull();
    expect(parseSeoRecommendationsFromMeta({ seoRecommendations: [] })).toBeNull();
  });

  test("returns state with score clamped 0–100 and suggestions array", () => {
    const state = parseSeoRecommendationsFromMeta({
      seoRecommendations: {
        lastScoredAt: "2025-01-01T00:00:00Z",
        score: 75,
        suggestions: [
          {
            id: "r1",
            type: "title_improvement",
            label: "SEO-tittel",
            before: "Old",
            suggested: "New",
            explanation: "Why",
            priority: "high",
            status: "pending",
            metaField: "seo.title",
          },
        ],
      },
    });
    expect(state).not.toBeNull();
    expect(state!.lastScoredAt).toBe("2025-01-01T00:00:00Z");
    expect(state!.score).toBe(75);
    expect(state!.suggestions).toHaveLength(1);
    expect(state!.suggestions[0].id).toBe("r1");
    expect(state!.suggestions[0].status).toBe("pending");
  });

  test("clamps score out of range to 0–100", () => {
    const high = parseSeoRecommendationsFromMeta({
      seoRecommendations: { score: 150, suggestions: [] },
    });
    const low = parseSeoRecommendationsFromMeta({
      seoRecommendations: { score: -10, suggestions: [] },
    });
    expect(high!.score).toBe(100);
    expect(low!.score).toBe(0);
  });

  test("malformed suggestion entries get defaulted fields", () => {
    const state = parseSeoRecommendationsFromMeta({
      seoRecommendations: {
        score: 50,
        suggestions: [{ type: "heading_hierarchy", suggested: "Fix" }],
      },
    });
    expect(state!.suggestions).toHaveLength(1);
    expect(state!.suggestions[0].label).toBe("");
    expect(state!.suggestions[0].before).toBe("");
    expect(state!.suggestions[0].explanation).toBe("");
    expect(state!.suggestions[0].priority).toBe("medium");
    expect(state!.suggestions[0].status).toBe("pending");
  });
});

describe("mergeSeoRecommendationsIntoMeta", () => {
  test("preserves applied/dismissed status by id when merging new result", () => {
    const meta = { seo: {}, other: "keep" };
    const existingState: SeoRecommendationsState = {
      lastScoredAt: "",
      score: 0,
      suggestions: [
        { id: "s1", type: "title_improvement", label: "T", before: "", suggested: "New", priority: "high", status: "applied", metaField: "seo.title" },
        { id: "s2", type: "meta_description_improvement", label: "D", before: "", suggested: "Desc", priority: "high", status: "dismissed" },
      ],
    };
    const result: SeoIntelligenceResult = {
      score: 80,
      message: "OK",
      suggestions: [
        { id: "s1", type: "title_improvement", label: "T", before: "", suggested: "New", priority: "high", status: "pending", metaField: "seo.title" },
        { id: "s2", type: "meta_description_improvement", label: "D", before: "", suggested: "Desc", priority: "high", status: "pending" },
      ],
    };
    const next = mergeSeoRecommendationsIntoMeta(meta, result, existingState);
    const rec = next.seoRecommendations as { suggestions: SeoRecommendation[] };
    expect(rec.suggestions.find((s) => s.id === "s1")?.status).toBe("applied");
    expect(rec.suggestions.find((s) => s.id === "s2")?.status).toBe("dismissed");
    expect(next.other).toBe("keep");
  });

  test("new suggestion ids get pending when no existing state", () => {
    const meta = {};
    const result: SeoIntelligenceResult = {
      score: 70,
      message: "OK",
      suggestions: [
        { id: "new1", type: "title_improvement", label: "T", before: "", suggested: "T", priority: "high", status: "pending", metaField: "seo.title" },
      ],
    };
    const next = mergeSeoRecommendationsIntoMeta(meta, result, null);
    const rec = next.seoRecommendations as { suggestions: SeoRecommendation[]; score: number };
    expect(rec.score).toBe(70);
    expect(rec.suggestions[0].status).toBe("pending");
  });
});

describe("editor integration: apply updates correct field, dismiss leaves content unchanged", () => {
  test("applying title suggestion updates only meta.seo.title", () => {
    const meta = { seo: { title: "Old", description: "Keep" } };
    const rec: SeoRecommendation = {
      id: "r1",
      type: "title_improvement",
      label: "T",
      before: "Old",
      suggested: "New Title",
      priority: "high",
      status: "pending",
      metaField: "seo.title",
    };
    const { nextMeta, applied } = applySeoRecommendationToMeta(meta, rec);
    expect(applied).toBe(true);
    expect((nextMeta as { seo?: { title?: string } }).seo?.title).toBe("New Title");
    expect((nextMeta as { seo?: { description?: string } }).seo?.description).toBe("Keep");
  });

  test("dismissing suggestion leaves meta.seo unchanged", () => {
    const meta = {
      seo: { title: "Original", description: "Desc" },
      seoRecommendations: {
        suggestions: [
          { id: "r1", type: "title_improvement", label: "T", before: "", suggested: "New", priority: "high", status: "pending", metaField: "seo.title" },
        ],
      },
    };
    const out = dismissSeoRecommendationInMeta(meta, {
      id: "r1",
      type: "title_improvement",
      label: "T",
      before: "",
      suggested: "New",
      priority: "high",
      status: "pending",
      metaField: "seo.title",
    });
    expect((out as { seo?: { title?: string } }).seo?.title).toBe("Original");
    expect((out as { seo?: { description?: string } }).seo?.description).toBe("Desc");
  });
});

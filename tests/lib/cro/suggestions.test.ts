/**
 * CRO suggestions: structured output, priorities, safe parsing.
 */
import { describe, test, expect } from "vitest";
import { analyzePageForCro } from "@/lib/cro/pageAnalysis";
import {
  buildCroSuggestions,
  getCroSuggestionCategory,
  normalizeCroSuggestion,
  normalizeCroSuggestions,
} from "@/lib/cro/suggestions";

describe("buildCroSuggestions", () => {
  test("returns structured suggestions with type, category, target, recommendedChange, rationale, priority, severity", () => {
    const analysis = analyzePageForCro({
      blocks: [
        { id: "r1", type: "richText", data: { body: "Short." } },
        { id: "c1", type: "cta", data: { buttonLabel: "Klikk her", title: "" } },
      ],
      meta: {},
    });

    const { suggestions } = buildCroSuggestions(analysis, { locale: "nb" });

    expect(suggestions.length).toBeGreaterThan(0);
    const first = suggestions[0];
    expect(first).toHaveProperty("type");
    expect(first).toHaveProperty("category");
    expect(["cta", "messaging", "structure", "trust", "friction", "offer"]).toContain(first.category);
    expect(first).toHaveProperty("target");
    expect(first).toHaveProperty("targetBlockId");
    expect(first).toHaveProperty("label");
    expect(first).toHaveProperty("before");
    expect(first).toHaveProperty("recommendedChange");
    expect(first).toHaveProperty("rationale");
    expect(first).toHaveProperty("priority");
    expect(first).toHaveProperty("severity");
    expect(["high", "medium", "low"]).toContain(first.priority);
    expect(["error", "warn", "info"]).toContain(first.severity);
  });

  test("missing CTA yields missing_cta suggestion (page-level, high)", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "r1", type: "richText", data: { body: "Intro text here." } }],
      meta: {},
    });
    const { suggestions } = buildCroSuggestions(analysis, { locale: "nb" });
    const missingCta = suggestions.find((s) => s.type === "missing_cta");
    expect(missingCta).toBeDefined();
    expect(missingCta?.target).toBe("page");
    expect(missingCta?.priority).toBe("high");
    expect(missingCta?.severity).toBe("error");
  });

  test("weak CTA yields weak_cta suggestion (block-level, targetBlockId and category cta)", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "c1", type: "cta", data: { buttonLabel: "Klikk her", title: "Go" } }],
      meta: {},
    });
    const { suggestions } = buildCroSuggestions(analysis, { locale: "nb" });
    const weakCta = suggestions.find((s) => s.type === "weak_cta");
    expect(weakCta).toBeDefined();
    expect(weakCta?.category).toBe("cta");
    expect(weakCta?.target).toBe("block");
    expect(weakCta?.targetBlockId).toBe("c1");
    expect(weakCta?.targetBlockIndex).toBe(0);
    expect(weakCta?.before).toContain("Klikk her");
    expect(weakCta?.recommendedChange).toContain("CTA");
  });

  test("missing headline yields missing_headline suggestion", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "r1", type: "richText", data: { body: "No heading" } }],
      meta: {},
    });
    const { suggestions } = buildCroSuggestions(analysis, { locale: "en" });
    const missingHeadline = suggestions.find((s) => s.type === "missing_headline");
    expect(missingHeadline).toBeDefined();
    expect(missingHeadline?.recommendedChange).toContain("headline");
  });

  test("no trust signals with body content yields no_trust_signals", () => {
    const longBody = Array.from({ length: 50 }, () => "word").join(" ");
    const analysis = analyzePageForCro({
      blocks: [{ id: "r1", type: "richText", data: { heading: "Intro", body: longBody } }],
      meta: {},
    });
    const { suggestions } = buildCroSuggestions(analysis, { locale: "nb" });
    const noTrust = suggestions.find((s) => s.type === "no_trust_signals");
    expect(noTrust).toBeDefined();
  });

  test("CTA and friction recommendations tied to correct page context (before and targetBlockId from analysis)", () => {
    const longBody = Array.from({ length: 210 }, () => "word").join(" ");
    const analysis = analyzePageForCro({
      blocks: [
        { id: "c1", type: "cta", data: { buttonLabel: "Klikk her", title: "Go" } },
        { id: "r1", type: "richText", data: { body: longBody } },
      ],
      meta: {},
    });
    const { suggestions } = buildCroSuggestions(analysis, { locale: "nb" });
    const weakCta = suggestions.find((s) => s.type === "weak_cta");
    expect(weakCta?.targetBlockId).toBe("c1");
    expect(weakCta?.before).toContain("Klikk her");
    const friction = suggestions.find((s) => s.type === "friction_long_paragraphs");
    expect(friction?.before).toMatch(/1.*200/);
    expect(friction?.recommendedChange).toContain("200");
  });

  test("good page yields fewer or zero suggestions", () => {
    const analysis = analyzePageForCro({
      blocks: [
        { id: "h1", type: "hero", data: { title: "Firmalunsj som fungerer" } },
        {
          id: "r1",
          type: "richText",
          data: { heading: "Fordeler", body: "Sikkerhet og compliance. Enkel oppsett. Be om demo for å komme i gang." },
        },
        { id: "c1", type: "cta", data: { title: "Be om demo", buttonLabel: "Be om demo" } },
      ],
      meta: { cro: { trustSignals: ["Sikkerhet"] } },
    });
    const { suggestions } = buildCroSuggestions(analysis, { locale: "nb" });
    expect(suggestions.filter((s) => s.type === "missing_cta").length).toBe(0);
    expect(suggestions.filter((s) => s.type === "weak_cta").length).toBe(0);
    expect(suggestions.filter((s) => s.type === "missing_headline").length).toBe(0);
    expect(suggestions.filter((s) => s.type === "no_trust_signals").length).toBe(0);
  });

  test("suggestions do not include auto-apply fields", () => {
    const analysis = analyzePageForCro({
      blocks: [{ id: "c1", type: "cta", data: { buttonLabel: "Send", title: "" } }],
      meta: {},
    });
    const { suggestions } = buildCroSuggestions(analysis);
    suggestions.forEach((s) => {
      expect(s).not.toHaveProperty("applyPatch");
      expect(s).not.toHaveProperty("metaField");
    });
  });
});

describe("normalizeCroSuggestion", () => {
  test("valid object returns normalized CroSuggestion", () => {
    const raw = {
      type: "weak_cta",
      target: "block",
      targetBlockId: "c1",
      label: "CTA",
      before: "Klikk her",
      recommendedChange: "Use specific label.",
      rationale: "Clarity.",
      priority: "high",
    };
    const s = normalizeCroSuggestion(raw);
    expect(s).not.toBeNull();
    expect(s?.type).toBe("weak_cta");
    expect(s?.target).toBe("block");
    expect(s?.targetBlockId).toBe("c1");
    expect(s?.severity).toBe("error");
  });

  test("invalid type returns null", () => {
    expect(normalizeCroSuggestion({ type: "invalid", label: "X", before: "", recommendedChange: "", rationale: "" })).toBeNull();
    expect(normalizeCroSuggestion({ type: "", label: "X", before: "", recommendedChange: "", rationale: "" })).toBeNull();
  });

  test("null or non-object returns null", () => {
    expect(normalizeCroSuggestion(null)).toBeNull();
    expect(normalizeCroSuggestion(undefined)).toBeNull();
    expect(normalizeCroSuggestion([])).toBeNull();
    expect(normalizeCroSuggestion("string")).toBeNull();
  });

  test("missing optional fields get defaults and category inferred from type", () => {
    const s = normalizeCroSuggestion({
      type: "missing_value_props",
      label: "",
      before: "",
      recommendedChange: "Add value props.",
      rationale: "Why.",
    });
    expect(s).not.toBeNull();
    expect(s?.category).toBe("messaging");
    expect(s?.target).toBe("page");
    expect(s?.targetBlockId).toBe("");
    expect(s?.priority).toBe("medium");
    expect(s?.severity).toBe("warn");
  });

  test("empty recommendedChange returns null (vague AI output fails safely)", () => {
    expect(normalizeCroSuggestion({ type: "weak_cta", recommendedChange: "", rationale: "X" })).toBeNull();
    expect(normalizeCroSuggestion({ type: "missing_cta", recommendedChange: "   ", rationale: "X" })).toBeNull();
  });
});

describe("getCroSuggestionCategory", () => {
  test("maps types to cta, messaging, structure, trust, friction, offer", () => {
    expect(getCroSuggestionCategory("missing_cta")).toBe("cta");
    expect(getCroSuggestionCategory("weak_cta")).toBe("cta");
    expect(getCroSuggestionCategory("multiple_ctas")).toBe("cta");
    expect(getCroSuggestionCategory("missing_headline")).toBe("messaging");
    expect(getCroSuggestionCategory("missing_value_props")).toBe("messaging");
    expect(getCroSuggestionCategory("short_intro")).toBe("friction");
    expect(getCroSuggestionCategory("no_trust_signals")).toBe("trust");
    expect(getCroSuggestionCategory("friction_long_paragraphs")).toBe("friction");
    expect(getCroSuggestionCategory("unclear_offer")).toBe("offer");
    expect(getCroSuggestionCategory("structure_cta_late")).toBe("structure");
  });
});

describe("normalizeCroSuggestions", () => {
  test("valid array returns all valid suggestions", () => {
    const raw = [
      { type: "missing_cta", label: "CTA", before: "", recommendedChange: "Add.", rationale: "Why.", priority: "high" },
      { type: "weak_headline", label: "H", before: "Hi", recommendedChange: "Longer.", rationale: "Why.", priority: "medium" },
    ];
    const out = normalizeCroSuggestions(raw);
    expect(out).toHaveLength(2);
  });

  test("malformed entries are skipped", () => {
    const raw = [
      { type: "missing_cta", label: "CTA", before: "", recommendedChange: "Add.", rationale: "Why." },
      { type: "invalid_type", label: "X", before: "", recommendedChange: "", rationale: "" },
      null,
    ];
    const out = normalizeCroSuggestions(raw);
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe("missing_cta");
  });

  test("non-array returns empty array", () => {
    expect(normalizeCroSuggestions(null)).toEqual([]);
    expect(normalizeCroSuggestions({})).toEqual([]);
  });

  test("malformed CRO AI output fails safely: all invalid entries yield empty array and does not throw", () => {
    const malformed = [
      { type: "invalid_type", recommendedChange: "X" },
      { type: "weak_cta", recommendedChange: "" },
      null,
      {},
    ];
    const out = normalizeCroSuggestions(malformed);
    expect(out).toHaveLength(0);
  });
});

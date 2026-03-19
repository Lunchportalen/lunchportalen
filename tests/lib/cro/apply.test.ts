/**
 * CRO apply safety: validation, allowlist, no overwrite.
 */
import { describe, test, expect } from "vitest";
import {
  validateCroSuggestionForApply,
  applyCroSuggestionToContent,
  isCroSuggestionApplicable,
} from "@/lib/cro/apply";
import type { CroRecommendation } from "@/lib/cro/editorState";

describe("validateCroSuggestionForApply", () => {
  test("invalid type returns valid: false", () => {
    const r = validateCroSuggestionForApply(
      { type: "missing_cta", target: "page", recommendedChange: "Add CTA" },
      {},
      []
    );
    expect(r.valid).toBe(false);
    expect(r.error).toBeDefined();
  });

  test("empty recommendedChange returns valid: false", () => {
    const r = validateCroSuggestionForApply(
      { type: "no_trust_signals", target: "page", recommendedChange: "" },
      {},
      []
    );
    expect(r.valid).toBe(false);
  });

  test("valid no_trust_signals (page target) returns valid: true", () => {
    const r = validateCroSuggestionForApply(
      {
        type: "no_trust_signals",
        target: "page",
        recommendedChange: "Set meta.cro.trustSignals",
      },
      {},
      []
    );
    expect(r.valid).toBe(true);
  });

  test("invalid meta returns valid: false", () => {
    const r = validateCroSuggestionForApply(
      {
        type: "no_trust_signals",
        target: "page",
        recommendedChange: "Set trust signals",
      },
      null as unknown as Record<string, unknown>,
      []
    );
    expect(r.valid).toBe(false);
  });
});

describe("applyCroSuggestionToContent", () => {
  test("no_trust_signals applies when meta.cro.trustSignals is empty", () => {
    const rec: CroRecommendation = {
      id: "cro_1",
      type: "no_trust_signals",
      category: "trust",
      target: "page",
      targetBlockId: "",
      label: "Tillitssignaler",
      before: "None",
      recommendedChange: "Set trust signals",
      rationale: "Trust",
      priority: "medium",
      severity: "warn",
      status: "pending" as const,
    };
    const meta = {
      cro: {},
      croRecommendations: { suggestions: [rec], score: 50, lastRunAt: "" },
    };
    const result = applyCroSuggestionToContent(meta, [], rec);
    expect(result.applied).toBe(true);
    expect((result.nextMeta.cro as Record<string, unknown>).trustSignals).toEqual([
      "Sikkerhet",
      "Compliance",
      "ESG",
    ]);
    const recState = result.nextMeta.croRecommendations as { suggestions: { id: string; status: string }[] };
    const appliedRec = recState.suggestions.find((s) => s.id === rec.id);
    expect(appliedRec?.status).toBe("applied");
  });

  test("no_trust_signals does not overwrite when trustSignals already set", () => {
    const meta = {
      cro: { trustSignals: ["Existing"] },
      croRecommendations: {
        suggestions: [
          {
            id: "cro_1",
            type: "no_trust_signals",
            status: "pending",
            label: "Tillit",
            recommendedChange: "Set",
            before: "",
            target: "page",
            targetBlockId: "",
          },
        ],
      },
    };
    const rec: CroRecommendation = {
      id: "cro_1",
      type: "no_trust_signals",
      category: "trust",
      target: "page",
      targetBlockId: "",
      label: "Tillit",
      before: "None",
      recommendedChange: "Set",
      rationale: "Trust",
      priority: "medium",
      severity: "warn",
      status: "pending" as const,
    };
    const result = applyCroSuggestionToContent(meta, [], rec);
    expect(result.applied).toBe(false);
    expect((result.nextMeta.cro as Record<string, unknown>).trustSignals).toEqual(["Existing"]);
  });

  test("inapplicable type returns applied: false and leaves meta unchanged", () => {
    const meta = {};
    const rec: CroRecommendation = {
      id: "cro_1",
      type: "weak_cta",
      category: "cta",
      target: "block",
      targetBlockId: "b1",
      label: "CTA",
      before: "Generic",
      recommendedChange: "Use specific label",
      rationale: "Clarity",
      priority: "high",
      severity: "error",
      status: "pending" as const,
    };
    const result = applyCroSuggestionToContent(meta, [{ id: "b1", type: "cta" }], rec);
    expect(result.applied).toBe(false);
    expect(result.nextMeta).toEqual(meta);
  });

  test("applying suggestion updates only intended target: other meta keys and blocks unchanged", () => {
    const rec: CroRecommendation = {
      id: "cro_1",
      type: "no_trust_signals",
      category: "trust",
      target: "page",
      targetBlockId: "",
      label: "Tillitssignaler",
      before: "None",
      recommendedChange: "Set trust signals",
      rationale: "Trust",
      priority: "medium",
      severity: "warn",
      status: "pending" as const,
    };
    const meta = {
      seo: { title: "Keep", description: "Keep" },
      intent: { intent: "convert" },
      cro: {},
      croRecommendations: { suggestions: [rec], score: 50, lastRunAt: "" },
    };
    const blocks = [{ id: "b1", type: "richText", data: { body: "Intro" } }];
    const result = applyCroSuggestionToContent(meta, blocks, rec);
    expect(result.applied).toBe(true);
    expect(result.nextMeta.seo).toEqual(meta.seo);
    expect(result.nextMeta.intent).toEqual(meta.intent);
    expect((result.nextMeta.cro as Record<string, unknown>).trustSignals).toEqual(["Sikkerhet", "Compliance", "ESG"]);
    expect(result.nextBlocks).toEqual(blocks);
  });
});

describe("isCroSuggestionApplicable", () => {
  test("no_trust_signals is applicable", () => {
    expect(isCroSuggestionApplicable("no_trust_signals")).toBe(true);
  });
  test("weak_cta is not applicable (no applyValue in model)", () => {
    expect(isCroSuggestionApplicable("weak_cta")).toBe(false);
  });
});

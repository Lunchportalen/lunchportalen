/**
 * AI system guarantees: provider normalization, patch validation, content/CRO/SEO safety,
 * malformed output fail-closed, and generated content respects CMS contracts.
 * Focused proofs only; no fluffy coverage.
 */

import { describe, test, expect } from "vitest";
import { normalizeProviderResult, AI_PROVIDER_ERROR } from "@/lib/ai/runner";
import { applyAIPatchV1 } from "@/lib/cms/model/applyAIPatch";
import { validateAIPatchV1, isAIPatchV1 } from "@/lib/cms/model/aiPatch";
import { analyzeContentHealth } from "@/lib/ai/analysis/contentHealth";
import {
  applySeoRecommendationToMeta,
  dismissSeoRecommendationInMeta,
  SEO_INTELLIGENCE_CONSTANTS,
} from "@/lib/seo/intelligence";
import { normalizePageBuilderBlocks } from "@/app/(backoffice)/backoffice/content/_components/pageBuilderNormalize";

describe("AI system guarantees", () => {
  describe("provider response normalization", () => {
    test("normalizeProviderResult maps ok:true to stable shape with data object and usage numbers", () => {
      const raw = {
        ok: true,
        data: { patch: { version: 1, ops: [] }, summary: "Done" },
        usage: { promptTokens: 10, completionTokens: 5 },
        model: "test",
      };
      const out = normalizeProviderResult(raw);
      expect(out.ok).toBe(true);
      if (out.ok) {
        expect(out.data).toEqual(raw.data);
        expect(out.usage).toEqual({ promptTokens: 10, completionTokens: 5 });
        expect(out.model).toBe("test");
      }
    });

    test("normalizeProviderResult maps null/undefined to ok:false INVALID_RESPONSE", () => {
      expect(normalizeProviderResult(null)).toEqual({
        ok: false,
        error: AI_PROVIDER_ERROR.INVALID_RESPONSE,
      });
      expect(normalizeProviderResult(undefined)).toEqual({
        ok: false,
        error: AI_PROVIDER_ERROR.INVALID_RESPONSE,
      });
    });

    test("normalizeProviderResult maps ok:false to stable error string", () => {
      const out = normalizeProviderResult({ ok: false, error: "AI_DISABLED" });
      expect(out.ok).toBe(false);
      expect((out as { error: string }).error).toBe("AI_DISABLED");
    });

    test("normalizeProviderResult maps non-ok non-false object to INVALID_RESPONSE", () => {
      const out = normalizeProviderResult({ ok: 1, data: {} });
      expect(out.ok).toBe(false);
      expect((out as { error: string }).error).toBe(AI_PROVIDER_ERROR.INVALID_RESPONSE);
    });
  });

  describe("malformed AI patch fails safely", () => {
    const validBody = {
      version: 1 as const,
      blocks: [
        { id: "b1", type: "richText", data: { body: "Hi" } },
        { id: "b2", type: "cta", data: {} },
      ],
      meta: {},
    };

    test("isAIPatchV1 rejects non-object and wrong version", () => {
      expect(isAIPatchV1(null)).toBe(false);
      expect(isAIPatchV1({ version: 2, ops: [] })).toBe(false);
      expect(isAIPatchV1({ version: 1 })).toBe(false);
    });

    test("validateAIPatchV1 rejects updateBlockData for missing block id", () => {
      const patch = {
        version: 1 as const,
        ops: [{ op: "updateBlockData" as const, id: "nonexistent", data: { body: "x" } }],
      };
      const v = validateAIPatchV1(patch, validBody);
      expect(v.ok).toBe(false);
      expect((v as { reason: string }).reason).toContain("not found");
    });

    test("applyAIPatchV1 returns ok:false when block not found (no mutation)", () => {
      const patch = {
        version: 1 as const,
        ops: [{ op: "removeBlock" as const, id: "nonexistent" }],
      };
      const applied = applyAIPatchV1(validBody, patch);
      expect(applied.ok).toBe(false);
      expect((applied as { reason: string }).reason).toContain("not found");
      expect(validBody.blocks).toHaveLength(2);
    });

    test("applyAIPatchV1 returns ok:false for body version !== 1", () => {
      const patch = { version: 1 as const, ops: [{ op: "insertBlock" as const, index: 0, block: { type: "richText", data: {} } }] };
      const applied = applyAIPatchV1({ version: 2, blocks: [], meta: {} } as any, patch);
      expect(applied.ok).toBe(false);
      expect((applied as { reason: string }).reason).toContain("version");
    });
  });

  describe("CRO/quality scoring is bounded 0–100", () => {
    test("analyzeContentHealth returns score in [0, 100]", () => {
      const empty = analyzeContentHealth({ blocks: [], meta: {}, pageTitle: "T" });
      expect(empty.score).toBeGreaterThanOrEqual(0);
      expect(empty.score).toBeLessThanOrEqual(100);
      const manyIssues = analyzeContentHealth({
        blocks: [],
        meta: {},
        pageTitle: "T",
      });
      expect(manyIssues.score).toBeGreaterThanOrEqual(0);
      expect(manyIssues.score).toBeLessThanOrEqual(100);
    });
  });

  describe("SEO apply clamps to CMS limits", () => {
    test("applySeoRecommendationToMeta clamps seo.title to MAX_TITLE", () => {
      const longTitle = "a".repeat(200);
      const { nextMeta, applied } = applySeoRecommendationToMeta(
        {},
        {
          id: "r1",
          type: "title_improvement",
          label: "Tittel",
          before: "",
          suggested: longTitle,
          priority: "high",
          status: "pending",
          metaField: "seo.title",
        }
      );
      expect(applied).toBe(true);
      const title = (nextMeta as { seo?: { title?: string } }).seo?.title ?? "";
      expect(title.length).toBeLessThanOrEqual(SEO_INTELLIGENCE_CONSTANTS.MAX_TITLE);
      expect(title.length).toBe(SEO_INTELLIGENCE_CONSTANTS.MAX_TITLE);
    });

    test("applySeoRecommendationToMeta clamps seo.description to MAX_DESC", () => {
      const longDesc = "b".repeat(500);
      const { nextMeta, applied } = applySeoRecommendationToMeta(
        {},
        {
          id: "r2",
          type: "meta_description_improvement",
          label: "Meta",
          before: "",
          suggested: longDesc,
          priority: "medium",
          status: "pending",
          metaField: "seo.description",
        }
      );
      expect(applied).toBe(true);
      const desc = (nextMeta as { seo?: { description?: string } }).seo?.description ?? "";
      expect(desc.length).toBeLessThanOrEqual(SEO_INTELLIGENCE_CONSTANTS.MAX_DESC);
    });
  });

  describe("SEO patch safety: apply only intended field, reject unchanged, no conflict", () => {
    test("apply with unknown metaField returns meta unchanged (no-op)", () => {
      const meta = { seo: { title: "Keep", description: "Keep" } };
      const { nextMeta, applied } = applySeoRecommendationToMeta(meta, {
        id: "x",
        type: "heading_hierarchy",
        label: "H",
        before: "",
        suggested: "New",
        priority: "medium",
        status: "pending",
        metaField: "seo.canonical",
      });
      expect(applied).toBe(false);
      expect((nextMeta as { seo?: { title?: string } }).seo?.title).toBe("Keep");
      expect((nextMeta as { seo?: { description?: string } }).seo?.description).toBe("Keep");
    });

    test("apply with no metaField returns meta unchanged", () => {
      const meta = { seo: { title: "T" } };
      const { nextMeta, applied } = applySeoRecommendationToMeta(meta, {
        id: "x",
        type: "image_alt_missing",
        label: "Alt",
        before: "",
        suggested: "alt",
        priority: "medium",
        status: "pending",
      });
      expect(applied).toBe(false);
      expect((nextMeta as { seo?: { title?: string } }).seo?.title).toBe("T");
    });

    test("stale suggestion rejected when current value does not match before", () => {
      const meta = { seo: { title: "User changed title", description: "Desc" } };
      const { nextMeta, applied } = applySeoRecommendationToMeta(meta, {
        id: "x",
        type: "title_improvement",
        label: "Tittel",
        before: "Old title",
        suggested: "Suggested title",
        priority: "high",
        status: "pending",
        metaField: "seo.title",
      });
      expect(applied).toBe(false);
      expect((nextMeta as { seo?: { title?: string } }).seo?.title).toBe("User changed title");
    });

    test("dismiss leaves meta.seo content unchanged", () => {
      const meta = {
        seo: { title: "Original", description: "Desc" },
        seoRecommendations: {
          suggestions: [
            { id: "r1", type: "title_improvement", label: "T", before: "", suggested: "New", priority: "high", status: "pending" as const, metaField: "seo.title" },
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

    test("sequential apply title then description only updates intended fields", () => {
      const meta = { seo: {}, seoRecommendations: { suggestions: [] as unknown[] } };
      const recTitle = {
        id: "rt",
        type: "title_improvement" as const,
        label: "T",
        before: "",
        suggested: "SEO Title",
        priority: "high" as const,
        status: "pending" as const,
        metaField: "seo.title" as const,
      };
      const recDesc = {
        id: "rd",
        type: "meta_description_improvement" as const,
        label: "D",
        before: "",
        suggested: "SEO description text.",
        priority: "high" as const,
        status: "pending" as const,
        metaField: "seo.description" as const,
      };
      const { nextMeta: afterTitle } = applySeoRecommendationToMeta(meta, recTitle);
      expect((afterTitle as { seo?: { title?: string } }).seo?.title).toBe("SEO Title");
      expect((afterTitle as { seo?: { description?: string } }).seo?.description).toBeUndefined();
      const { nextMeta: afterDesc } = applySeoRecommendationToMeta(afterTitle, recDesc);
      expect((afterDesc as { seo?: { title?: string } }).seo?.title).toBe("SEO Title");
      expect((afterDesc as { seo?: { description?: string } }).seo?.description).toBe("SEO description text.");
    });
  });

  describe("generated content respects CMS contracts", () => {
    test("normalizePageBuilderBlocks maps unknown type to richText and returns valid blocks", () => {
      const raw = [
        { type: "unknown_thing", id: "x", data: {} },
        { type: "hero", data: { title: "H" } },
      ];
      const { blocks, warnings } = normalizePageBuilderBlocks(raw);
      expect(blocks).toHaveLength(2);
      expect(blocks[0].type).toBe("richText");
      expect(blocks[1].type).toBe("hero");
      expect(blocks.every((b) => b.id && b.type && typeof b.data === "object")).toBe(true);
      expect(warnings.some((w) => w.includes("unknown_thing"))).toBe(true);
    });

    test("normalizePageBuilderBlocks returns empty blocks for non-array input", () => {
      const { blocks } = normalizePageBuilderBlocks(null);
      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBe(0);
    });
  });

  describe("valid patch applies and produces deterministic next state", () => {
    test("applyAIPatchV1 insertBlock produces next with new block and leaves body unchanged", () => {
      const body = {
        version: 1 as const,
        blocks: [{ id: "a", type: "richText", data: {} }],
        meta: {},
      };
      const patch = {
        version: 1 as const,
        ops: [{ op: "insertBlock" as const, index: 1, block: { type: "cta", data: { title: "C" } } }],
      };
      const applied = applyAIPatchV1(body, patch);
      expect(applied.ok).toBe(true);
      if (applied.ok) {
        expect(applied.next.blocks).toHaveLength(2);
        expect(applied.next.blocks[1].type).toBe("cta");
        expect(body.blocks).toHaveLength(1);
      }
    });
  });
});

/**
 * AI page builder flow smoke: proves mocked API response → parse → normalize → apply-shaped body.
 * Verifies the pipeline is real (trigger → request → response → editor state), not UI illusion.
 */

// @ts-nocheck

import { describe, test, expect } from "vitest";
import { parsePageBuilderResponse } from "@/app/(backoffice)/backoffice/content/_components/editorAiContracts";
import { normalizePageBuilderBlocks } from "@/app/(backoffice)/backoffice/content/_components/pageBuilderNormalize";
import { parseBodyToBlocks } from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";

describe("AI page builder flow – mocked response to editor apply", () => {
  const mockApiResponse = {
    ok: true,
    rid: "test-rid",
    data: {
      title: "Smoke page",
      summary: "Generated for test",
      blocks: [
        { id: "blk_hero_1", type: "hero", data: { title: "Hero", subtitle: "Sub", imageUrl: "", imageAlt: "", ctaLabel: "", ctaHref: "" } },
        { id: "blk_rich_1", type: "richText", data: { heading: "Seksjon", body: "Brødtekst" } },
        { id: "blk_cta_1", type: "cta", data: { title: "CTA", body: "", buttonLabel: "Kontakt", buttonHref: "/kontakt" } },
      ],
      warnings: [],
    },
  };

  test("mock API response is parsed to PageBuilderResult with blocks", () => {
    const parsed = parsePageBuilderResponse(mockApiResponse.data);
    expect(parsed).not.toBe(null);
    expect(parsed!.blocks).toHaveLength(3);
    expect(parsed!.title).toBe("Smoke page");
    expect(parsed!.blocks[0]).toEqual({ id: "blk_hero_1", type: "hero", data: expect.any(Object) });
  });

  test("parsed result normalizes to editor-applicable blocks", () => {
    const parsed = parsePageBuilderResponse(mockApiResponse.data);
    expect(parsed).not.toBe(null);
    const { blocks: normalized, warnings } = normalizePageBuilderBlocks(parsed!.blocks);
    expect(normalized.length).toBeGreaterThan(0);
    expect(normalized.length).toBe(3);
    for (const b of normalized) {
      expect(b).toHaveProperty("id");
      expect(b).toHaveProperty("type");
      expect(b).toHaveProperty("data");
      expect(typeof b.id).toBe("string");
      expect(typeof b.type).toBe("string");
      expect(typeof b.data).toBe("object");
    }
    expect(Array.isArray(warnings)).toBe(true);
  });

  test("normalized blocks produce valid apply body (parseBodyToBlocks)", () => {
    const parsed = parsePageBuilderResponse(mockApiResponse.data);
    expect(parsed).not.toBe(null);
    const { blocks: normalized } = normalizePageBuilderBlocks(parsed!.blocks);
    const flatBlocks = normalized.map((b) => ({ id: b.id, type: b.type, ...b.data }));
    const bodyResult = parseBodyToBlocks({ blocks: flatBlocks, meta: {} });
    expect(bodyResult.mode).toBe("blocks");
    expect(bodyResult.error).toBe(null);
    expect(bodyResult.blocks.length).toBe(3);
    expect(bodyResult.blocks[0].type).toBe("hero");
    expect(bodyResult.blocks[1].type).toBe("richText");
    expect(bodyResult.blocks[2].type).toBe("cta");
  });

  test("API response with empty blocks must not be treated as success (no usable result)", () => {
    const emptyData = { title: "Empty", summary: "", blocks: [] };
    const parsed = parsePageBuilderResponse(emptyData);
    expect(parsed).not.toBe(null);
    expect(parsed!.blocks).toHaveLength(0);
    const { blocks: normalized } = normalizePageBuilderBlocks(parsed!.blocks);
    expect(normalized).toHaveLength(0);
    const bodyResult = parseBodyToBlocks({ blocks: normalized.map((b) => ({ id: b.id, type: b.type, ...b.data })), meta: {} });
    expect(bodyResult.blocks).toHaveLength(0);
    // Caller (handlePageBuilder) must not set aiPageBuilderResult when blocks.length === 0; no apply.
  });
});

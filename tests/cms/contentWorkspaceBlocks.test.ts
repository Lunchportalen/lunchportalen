/**
 * ContentWorkspace blocks invariants:
 * - parseBodyToBlocks correctly classifies legacy/blocks/invalid bodies
 * - deriveBodyForSave and serializeBlocksToBody are deterministic
 */

// @ts-nocheck

import { describe, test, expect } from "vitest";
import { createBackofficeBlockDraft } from "@/lib/cms/backofficeBlockCatalog";

import {
  createBlock,
  parseBodyToBlocks,
  deriveBodyForSave,
  serializeBlocksToBody,
  type Block,
} from "@/app/(backoffice)/backoffice/content/_components/contentWorkspace.blocks";

describe("contentWorkspace.blocks – parseBodyToBlocks", () => {
  test("returns legacy mode for plain string body", () => {
    const res = parseBodyToBlocks("plain text body");
    expect(res.mode).toBe("legacy");
    expect(res.blocks).toEqual([]);
    expect(res.legacyText).toBe("plain text body");
    expect(res.error).toBeNull();
  });

  test("returns blocks mode for envelope { blocks, meta }", () => {
    const body = {
      blocks: [
        { id: "b1", type: "richText", heading: "H", body: "B" },
        { id: "b2", type: "divider" },
      ],
      meta: { layout: "full" },
    };
    const res = parseBodyToBlocks(body);
    expect(res.mode).toBe("blocks");
    expect(res.blocks.length).toBe(2);
    expect(res.meta).toEqual({ layout: "full" });
    expect(res.error).toBeNull();
  });

  test("returns invalid mode for malformed JSON string", () => {
    const res = parseBodyToBlocks('{"blocks": "not-an-array"}');
    expect(res.mode).toBe("invalid");
    expect(res.blocks).toEqual([]);
    expect(res.error).toBe("Invalid body format.");
  });
});

describe("contentWorkspace.blocks – deriveBodyForSave / serializeBlocksToBody", () => {
  const sampleBlocks: Block[] = [
    {
      id: "h1",
      type: "hero",
      title: "Title",
      subtitle: "Sub",
      imageUrl: "",
      imageAlt: "",
      ctaLabel: "",
      ctaHref: "",
    },
  ];
  const sampleMeta = { layout: "full" };

  test("serializeBlocksToBody wraps blocks + meta", () => {
    const json = serializeBlocksToBody(sampleBlocks, sampleMeta);
    const parsed = JSON.parse(json);
    expect(parsed.blocks).toBeDefined();
    expect(parsed.meta).toEqual(sampleMeta);
    expect(parsed.blocks[0].id).toBe("h1");
  });

  test("deriveBodyForSave uses structured body in blocks mode", () => {
    const json = deriveBodyForSave("blocks", sampleBlocks, sampleMeta, "legacy", "invalid");
    const parsed = JSON.parse(json);
    expect(parsed.blocks[0].id).toBe("h1");
    expect(parsed.meta).toEqual(sampleMeta);
  });

  test("deriveBodyForSave returns legacy text in legacy mode", () => {
    const json = deriveBodyForSave("legacy", sampleBlocks, sampleMeta, "legacy-body", "ignored");
    expect(json).toBe("legacy-body");
  });

  test("deriveBodyForSave returns invalidRaw in invalid mode", () => {
    const json = deriveBodyForSave("invalid", sampleBlocks, sampleMeta, "legacy-body", "raw-invalid");
    expect(json).toBe("raw-invalid");
  });

  test("round-trip: serialize then parse yields same blocks and meta (premium editor consistency)", () => {
    const blocks: Block[] = [
      {
        id: "b1",
        type: "hero",
        title: "Hero",
        subtitle: "Sub",
        imageUrl: "",
        imageAlt: "",
        ctaLabel: "CTA",
        ctaHref: "/demo",
      },
      { id: "b2", type: "divider" },
    ];
    const meta = { layout: "full" };
    const json = serializeBlocksToBody(blocks, meta);
    const parsed = parseBodyToBlocks(json);
    expect(parsed.mode).toBe("blocks");
    expect(parsed.blocks.length).toBe(2);
    expect(parsed.blocks[0].type).toBe("hero");
    expect(parsed.blocks[1].type).toBe("divider");
    expect(parsed.meta).toEqual(meta);
  });

  test("block order is preserved across serialize and parse", () => {
    const blocks: Block[] = [
      { id: "a", type: "divider" },
      {
        id: "b",
        type: "hero",
        title: "T",
        subtitle: "",
        imageUrl: "",
        imageAlt: "",
        ctaLabel: "",
        ctaHref: "",
      },
    ];
    const json = serializeBlocksToBody(blocks, {});
    const parsed = parseBodyToBlocks(json);
    expect(parsed.blocks[0].id).toBe("a");
    expect(parsed.blocks[1].id).toBe("b");
  });

  test("createBlock uses the canonical backoffice block draft defaults", () => {
    const pricingBlock = createBlock("pricing");
    const canonicalDraft = createBackofficeBlockDraft("pricing");

    expect(pricingBlock.type).toBe("pricing");
    expect(pricingBlock.title).toBe(canonicalDraft?.title);
    expect(pricingBlock.plans).toEqual(canonicalDraft?.plans);
  });
});


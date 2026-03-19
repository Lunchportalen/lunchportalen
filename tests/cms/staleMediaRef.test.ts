/**
 * Stale media ref: normalizePageBuilderBlocks clears mediaItemId when URL/assetPath missing.
 * Proves: stale picker/media state does not corrupt content on save.
 */
// @ts-nocheck

import { describe, test, expect } from "vitest";
import { normalizePageBuilderBlocks } from "@/app/(backoffice)/backoffice/content/_components/pageBuilderNormalize";

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234";

describe("stale media ref — clearStaleMediaRef via normalizePageBuilderBlocks", () => {
  test("hero with mediaItemId but no imageUrl has mediaItemId removed", () => {
    const { blocks } = normalizePageBuilderBlocks([
      { type: "hero", data: { title: "T", mediaItemId: VALID_UUID } },
    ]);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("hero");
    expect(blocks[0].data.mediaItemId).toBeUndefined();
    expect(blocks[0].data.imageUrl).toBe("");
  });

  test("hero with mediaItemId and imageUrl keeps mediaItemId", () => {
    const { blocks } = normalizePageBuilderBlocks([
      { type: "hero", data: { title: "T", imageUrl: "https://cdn.test/h.jpg", mediaItemId: VALID_UUID } },
    ]);
    expect(blocks.length).toBe(1);
    expect(blocks[0].data.imageUrl).toBe("https://cdn.test/h.jpg");
    expect(blocks[0].data.mediaItemId).toBe(VALID_UUID);
  });

  test("image with mediaItemId but no assetPath has mediaItemId removed", () => {
    const { blocks } = normalizePageBuilderBlocks([
      { type: "image", data: { alt: "A", mediaItemId: VALID_UUID } },
    ]);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("image");
    expect(blocks[0].data.mediaItemId).toBeUndefined();
    expect(blocks[0].data.assetPath).toBe("");
  });

  test("image with mediaItemId and assetPath keeps mediaItemId", () => {
    const { blocks } = normalizePageBuilderBlocks([
      { type: "image", data: { assetPath: "https://cdn.test/p.jpg", alt: "A", mediaItemId: VALID_UUID } },
    ]);
    expect(blocks.length).toBe(1);
    expect(blocks[0].data.assetPath).toBe("https://cdn.test/p.jpg");
    expect(blocks[0].data.mediaItemId).toBe(VALID_UUID);
  });
});

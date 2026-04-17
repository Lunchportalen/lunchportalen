// tests/cms/resolveBlockMediaDeep.test.ts
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/cms/media/resolveMedia", () => ({
  resolveMedia: vi.fn(),
}));

import { resolveMediaInNormalizedBlocks } from "@/lib/cms/media/resolveBlockMediaDeep";
import { resolveMedia } from "@/lib/cms/media/resolveMedia";
import type { BlockNode } from "@/lib/cms/model/blockTypes";

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234";

describe("resolveMediaInNormalizedBlocks", () => {
  beforeEach(() => {
    vi.mocked(resolveMedia).mockReset();
  });

  test("passes mediaVariantKey to resolveMedia for mediaItemId", async () => {
    vi.mocked(resolveMedia).mockResolvedValue("https://cdn.example/w640.jpg");
    const blocks: BlockNode[] = [
      {
        id: "b1",
        type: "image",
        data: {
          mediaItemId: VALID_UUID,
          mediaVariantKey: "w640",
          alt: "X",
        },
      },
    ];
    const out = await resolveMediaInNormalizedBlocks(blocks);
    expect(resolveMedia).toHaveBeenCalledWith(VALID_UUID, { variantKey: "w640" });
    expect((out[0].data as Record<string, unknown>).image).toBe("https://cdn.example/w640.jpg");
  });

  test("does not overwrite existing image URL", async () => {
    vi.mocked(resolveMedia).mockResolvedValue("https://cdn.example/new.jpg");
    const blocks: BlockNode[] = [
      {
        id: "b1",
        type: "image",
        data: {
          mediaItemId: VALID_UUID,
          image: "https://cdn.example/existing.jpg",
        },
      },
    ];
    const out = await resolveMediaInNormalizedBlocks(blocks);
    expect(resolveMedia).not.toHaveBeenCalled();
    expect((out[0].data as Record<string, unknown>).image).toBe("https://cdn.example/existing.jpg");
  });
});

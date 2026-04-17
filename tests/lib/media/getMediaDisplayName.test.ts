// tests/lib/media/getMediaDisplayName.test.ts
// @ts-nocheck

import { describe, test, expect } from "vitest";
import { getMediaDisplayName } from "@/lib/media/displayName";
import type { MediaItem } from "@/lib/media";

function baseItem(over: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "a1b2c3d4-e5f6-4789-a012-345678901234",
    type: "image",
    status: "ready",
    source: "upload",
    url: "https://cdn.example/x.jpg",
    alt: "",
    tags: [],
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("getMediaDisplayName", () => {
  test("prefers metadata.displayName", () => {
    expect(getMediaDisplayName(baseItem({ metadata: { displayName: "  Hero  " } }))).toBe("Hero");
  });

  test("falls back to caption then first tag", () => {
    expect(getMediaDisplayName(baseItem({ caption: "Cap", metadata: {} }))).toBe("Cap");
    expect(getMediaDisplayName(baseItem({ tags: ["first", "second"], metadata: {} }))).toBe("first");
  });

  test("uses short id when nothing else", () => {
    const s = getMediaDisplayName(baseItem({ metadata: {} }));
    expect(s.length).toBeGreaterThan(3);
    expect(s).toContain("a1b2c3d4");
  });
});

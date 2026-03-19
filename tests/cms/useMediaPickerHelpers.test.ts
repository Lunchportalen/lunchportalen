// tests/cms/useMediaPickerHelpers.test.ts
// @ts-nocheck

import { describe, test, expect } from "vitest";

import {
  applyMediaSelectionToBlock,
  hasValidSelectionUrl,
  type MediaPickerTarget,
} from "@/app/(backoffice)/backoffice/content/_components/useMediaPicker";

describe("useMediaPicker – applyMediaSelectionToBlock (hero blocks)", () => {
  const baseHero = {
    id: "hero-1",
    type: "hero",
    imageUrl: "https://cdn.test/old.jpg",
    mediaItemId: "old-media-id",
    imageAlt: "Gammel alt",
  };

  const target: MediaPickerTarget = {
    blockId: "hero-1",
    field: "heroImageUrl",
  };

  test("updates imageUrl and keeps existing mediaItemId / imageAlt when item is string", () => {
    const updated = applyMediaSelectionToBlock(baseHero, target, "https://cdn.test/new.jpg");

    expect(updated).toMatchObject({
      type: "hero",
      imageUrl: "https://cdn.test/new.jpg",
      mediaItemId: "old-media-id",
      imageAlt: "Gammel alt",
    });
  });

  test("sets mediaItemId and trims non-empty alt from item object", () => {
    const updated = applyMediaSelectionToBlock(baseHero, target, {
      id: "media-123",
      url: "https://cdn.test/new-hero.jpg",
      alt: "  Ny alt-tekst  ",
    });

    expect(updated.imageUrl).toBe("https://cdn.test/new-hero.jpg");
    expect(updated.mediaItemId).toBe("media-123");
    expect(updated.imageAlt).toBe("Ny alt-tekst");
  });

  test("falls back to existing imageAlt when alt is empty or whitespace", () => {
    const updated = applyMediaSelectionToBlock(baseHero, target, {
      id: "media-456",
      url: "https://cdn.test/new-hero-2.jpg",
      alt: "   ",
    });

    expect(updated.imageAlt).toBe("Gammel alt");
  });
});

describe("useMediaPicker – applyMediaSelectionToBlock (image blocks)", () => {
  const baseImage = {
    id: "img-1",
    type: "image",
    assetPath: "https://cdn.test/old-img.jpg",
    mediaItemId: "old-media-id",
    alt: "Gammel alt",
  };

  const target: MediaPickerTarget = {
    blockId: "img-1",
    field: "imageUrl",
  };

  test("updates assetPath and keeps existing mediaItemId / alt when item is string", () => {
    const updated = applyMediaSelectionToBlock(baseImage, target, "https://cdn.test/new-img.jpg");

    expect(updated).toMatchObject({
      type: "image",
      assetPath: "https://cdn.test/new-img.jpg",
      mediaItemId: "old-media-id",
      alt: "Gammel alt",
    });
  });

  test("sets mediaItemId and trims non-empty alt from item object", () => {
    const updated = applyMediaSelectionToBlock(baseImage, target, {
      id: "media-img-1",
      url: "https://cdn.test/new-img-2.jpg",
      alt: "  Ny beskrivelse  ",
    });

    expect(updated.assetPath).toBe("https://cdn.test/new-img-2.jpg");
    expect(updated.mediaItemId).toBe("media-img-1");
    expect(updated.alt).toBe("Ny beskrivelse");
  });

  test("falls back to existing alt when alt is empty or whitespace", () => {
    const updated = applyMediaSelectionToBlock(baseImage, target, {
      id: "media-img-2",
      url: "https://cdn.test/new-img-3.jpg",
      alt: "   ",
    });

    expect(updated.alt).toBe("Gammel alt");
  });
});

describe("useMediaPicker – applyMediaSelectionToBlock (banners blocks)", () => {
  const baseBanners = {
    id: "banners-1",
    type: "banners",
    items: [
      { id: "b1", imageUrl: "old-1.jpg", videoUrl: null },
      { id: "b2", imageUrl: "old-2.jpg", videoUrl: null },
    ],
  };

  const targetImage: MediaPickerTarget = {
    blockId: "banners-1",
    field: "imageUrl",
    itemId: "b2",
  };

  const targetVideo: MediaPickerTarget = {
    blockId: "banners-1",
    field: "videoUrl",
    itemId: "b1",
  };

  test("updates only the targeted banner item for imageUrl", () => {
    const updated = applyMediaSelectionToBlock(baseBanners, targetImage, "new-banner.jpg");

    expect(updated.items[0].imageUrl).toBe("old-1.jpg");
    expect(updated.items[1].imageUrl).toBe("new-banner.jpg");
  });

  test("updates only the targeted banner item for videoUrl", () => {
    const updated = applyMediaSelectionToBlock(baseBanners, targetVideo, "https://cdn.test/video.mp4");

    expect(updated.items[0].videoUrl).toBe("https://cdn.test/video.mp4");
    expect(updated.items[1].videoUrl).toBeNull();
  });

  test("returns original block when type is not banners or itemId is missing", () => {
    const notBanners = { id: "x", type: "hero" };
    const noItemTarget: MediaPickerTarget = { blockId: "banners-1", field: "imageUrl" };

    expect(applyMediaSelectionToBlock(notBanners, targetImage, "url")).toBe(notBanners);
    expect(applyMediaSelectionToBlock(baseBanners, noItemTarget, "url")).toBe(baseBanners);
  });
});

describe("useMediaPicker – media reference safety (URL not stored as mediaItemId)", () => {
  test("when selection item id is a URL, mediaItemId is not set on block", () => {
    const baseImage = {
      id: "img-1",
      type: "image",
      assetPath: "",
      mediaItemId: undefined as string | undefined,
      alt: "",
    };
    const target: MediaPickerTarget = { blockId: "img-1", field: "imageUrl" };
    const itemWithUrlAsId = {
      id: "https://cdn.example.com/asset.jpg",
      url: "https://cdn.example.com/asset.jpg",
      alt: "Alt",
    };
    const updated = applyMediaSelectionToBlock(baseImage, target, itemWithUrlAsId);
    expect(updated.assetPath).toBe("https://cdn.example.com/asset.jpg");
    expect(updated.alt).toBe("Alt");
    expect(updated.mediaItemId).toBeUndefined();
  });

  test("when selection item id is a path starting with slash, mediaItemId is not set", () => {
    const baseHero = {
      id: "hero-1",
      type: "hero",
      imageUrl: "",
      mediaItemId: undefined as string | undefined,
      imageAlt: "",
    };
    const target: MediaPickerTarget = { blockId: "hero-1", field: "heroImageUrl" };
    const updated = applyMediaSelectionToBlock(baseHero, target, {
      id: "/uploads/photo.jpg",
      url: "https://cdn.example/uploads/photo.jpg",
    });
    expect(updated.imageUrl).toBe("https://cdn.example/uploads/photo.jpg");
    expect(updated.mediaItemId).toBeUndefined();
  });
});

describe("useMediaPicker – invalid selection (no url) fails safely", () => {
  test("hasValidSelectionUrl returns false for empty string or missing url", () => {
    expect(hasValidSelectionUrl("")).toBe(false);
    expect(hasValidSelectionUrl("   ")).toBe(false);
    expect(hasValidSelectionUrl({ url: "", id: "x" })).toBe(false);
    expect(hasValidSelectionUrl({ url: "  ", alt: "x" })).toBe(false);
  });

  test("hasValidSelectionUrl returns true for non-empty url", () => {
    expect(hasValidSelectionUrl("https://cdn.test/img.jpg")).toBe(true);
    expect(hasValidSelectionUrl({ url: "https://a/b", id: "m1" })).toBe(true);
  });

  test("applyMediaSelectionToBlock returns block unchanged when item has no url", () => {
    const base = { id: "h1", type: "hero", imageUrl: "old", imageAlt: "" };
    const target: MediaPickerTarget = { blockId: "h1", field: "heroImageUrl" };
    expect(applyMediaSelectionToBlock(base, target, "")).toBe(base);
    expect(applyMediaSelectionToBlock(base, target, { url: "", id: "m1" })).toBe(base);
  });

  test("picker stores canonical media reference: url and valid id both set on block", () => {
    const uuid = "a1b2c3d4-e5f6-4789-a012-345678901234";
    const base = { id: "img-1", type: "image", assetPath: "", alt: "", mediaItemId: undefined };
    const target: MediaPickerTarget = { blockId: "img-1", field: "imageUrl" };
    const item = { id: uuid, url: "https://cdn.test/canonical.jpg", alt: "Canonical alt" };
    const updated = applyMediaSelectionToBlock(base, target, item);
    expect(updated.assetPath).toBe("https://cdn.test/canonical.jpg");
    expect(updated.mediaItemId).toBe(uuid);
    expect(updated.alt).toBe("Canonical alt");
  });
});


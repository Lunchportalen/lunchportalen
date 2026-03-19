/**
 * Media domain guarantees: parse, validation, renderSafe, normalize.
 * Proves: valid records load deterministically; invalid ingest rejected; metadata bounded; preview resolution.
 */
// @ts-nocheck

import { describe, test, expect } from "vitest";
import { parseMediaItemFromApi, parseMediaItemListFromApi } from "@/lib/media/parse";
import {
  validateMediaUrl,
  MEDIA_ALT_MAX,
  MEDIA_CAPTION_MAX,
  MEDIA_URL_MAX_LEN,
} from "@/lib/media/validation";
import { safeAltForImg, safeCaptionForFigcaption } from "@/lib/media/renderSafe";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";

describe("media parse — valid records load deterministically", () => {
  test("parseMediaItemFromApi returns null when id or url missing", () => {
    expect(parseMediaItemFromApi(null)).toBeNull();
    expect(parseMediaItemFromApi(undefined)).toBeNull();
    expect(parseMediaItemFromApi({})).toBeNull();
    expect(parseMediaItemFromApi({ id: "a1b2c3d4-e5f6-4789-a012-345678901234" })).toBeNull();
    expect(parseMediaItemFromApi({ url: "https://a/b" })).toBeNull();
    expect(parseMediaItemFromApi({ id: "a1b2c3d4-e5f6-4789-a012-345678901234", url: "" })).toBeNull();
  });

  test("parseMediaItemFromApi returns MediaItem when id and url valid; same input → same output", () => {
    const raw = {
      id: "a1b2c3d4-e5f6-4789-a012-345678901234",
      url: "https://cdn.test/img.jpg",
      alt: "Alt",
      type: "image",
      status: "ready",
    };
    const a = parseMediaItemFromApi(raw);
    const b = parseMediaItemFromApi(raw);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a!.id).toBe(b!.id);
    expect(a!.url).toBe(b!.url);
    expect(a!.url).toBe("https://cdn.test/img.jpg");
  });

  test("parseMediaItemListFromApi skips entries without valid id/url; only valid items in result", () => {
    const rawList = [
      { id: "a1b2c3d4-e5f6-4789-a012-345678901234", url: "https://a/1.jpg" },
      { id: "https://b/2.jpg", url: "https://b/2.jpg" },
      { url: "https://c/3.jpg" },
      { id: "b2c3d4e5-f6a7-4890-b123-456789012345", url: "" },
    ];
    const out = parseMediaItemListFromApi(rawList);
    expect(out.length).toBe(1);
    expect(out[0].id).toBe("a1b2c3d4-e5f6-4789-a012-345678901234");
    expect(out[0].url).toBe("https://a/1.jpg");
  });
});

describe("media validation — invalid upload/ingest does not create broken truth", () => {
  test("validateMediaUrl rejects empty, non-http(s), and dangerous schemes", () => {
    expect(validateMediaUrl("").ok).toBe(false);
    expect(validateMediaUrl("   ").ok).toBe(false);
    expect(validateMediaUrl("ftp://x").ok).toBe(false);
    expect(validateMediaUrl("javascript:alert(1)").ok).toBe(false);
    expect(validateMediaUrl("data:text/plain,x").ok).toBe(false);
    expect(validateMediaUrl("vbscript:x").ok).toBe(false);
  });

  test("validateMediaUrl accepts http and https", () => {
    expect(validateMediaUrl("https://cdn.example.com/img.jpg").ok).toBe(true);
    expect(validateMediaUrl("http://localhost/asset.jpg").ok).toBe(true);
  });

  test("validateMediaUrl rejects URL over MEDIA_URL_MAX_LEN", () => {
    const long = "https://a/" + "x".repeat(MEDIA_URL_MAX_LEN);
    expect(validateMediaUrl(long).ok).toBe(false);
  });

  test("metadata bounds: safeAltForImg and safeCaptionForFigcaption cap length", () => {
    const longAlt = "a".repeat(300);
    expect(safeAltForImg(longAlt).length).toBe(MEDIA_ALT_MAX);
    const longCaption = "b".repeat(600);
    expect(safeCaptionForFigcaption(longCaption).length).toBe(MEDIA_CAPTION_MAX);
  });

  test("safeAltForImg uses caption fallback when alt empty; safeCaptionForFigcaption uses alt fallback", () => {
    expect(safeAltForImg("", "Caption text")).toBe("Caption text");
    expect(safeCaptionForFigcaption("", "Alt text")).toBe("Alt text");
  });
});

describe("preview/public — normalizeBlockForRender resolves display URL", () => {
  test("assetPath maps to src for image block", () => {
    const block = { id: "i1", type: "image", data: { assetPath: "https://cdn.test/pic.jpg", alt: "A" } };
    const node = normalizeBlockForRender(block, 0);
    expect(node.data.src).toBe("https://cdn.test/pic.jpg");
  });

  test("imageUrl maps to src when assetPath missing (e.g. hero)", () => {
    const block = { id: "h1", type: "hero", data: { imageUrl: "https://cdn.test/hero.jpg" } };
    const node = normalizeBlockForRender(block, 0);
    expect(node.data.src).toBe("https://cdn.test/hero.jpg");
  });

  test("non-string assetPath/imageUrl does not set src", () => {
    const block = { id: "i1", type: "image", data: { assetPath: 123, alt: "" } };
    const node = normalizeBlockForRender(block, 0);
    expect(node.data.src).toBeUndefined();
  });
});

// tests/lib/media/variantResolution.test.ts
// @ts-nocheck

import { describe, test, expect } from "vitest";
import {
  MEDIA_VARIANTS_MAX_KEYS,
  normalizeVariantsMap,
  pickResolvedUrlFromMetadata,
} from "@/lib/media/variantResolution";

describe("normalizeVariantsMap", () => {
  test("returns undefined for non-objects", () => {
    expect(normalizeVariantsMap(null)).toBeUndefined();
    expect(normalizeVariantsMap([])).toBeUndefined();
    expect(normalizeVariantsMap("x")).toBeUndefined();
  });

  test("keeps only valid https URLs with bounded keys", () => {
    const out = normalizeVariantsMap({
      w640: "https://cdn.example/w640.jpg",
      bad: "ftp://x",
      empty: "",
    });
    expect(out).toEqual({ w640: "https://cdn.example/w640.jpg" });
  });

  test("caps number of keys", () => {
    const raw: Record<string, string> = {};
    for (let i = 0; i < MEDIA_VARIANTS_MAX_KEYS + 5; i += 1) {
      raw[`k${i}`] = `https://cdn.example/${i}.jpg`;
    }
    const out = normalizeVariantsMap(raw);
    expect(Object.keys(out ?? {}).length).toBe(MEDIA_VARIANTS_MAX_KEYS);
  });
});

describe("pickResolvedUrlFromMetadata", () => {
  const primary = "https://cdn.example/main.jpg";

  test("returns primary when no variant key", () => {
    expect(pickResolvedUrlFromMetadata(primary, { variants: { w640: "https://cdn.example/w.jpg" } }, undefined)).toBe(
      primary
    );
    expect(pickResolvedUrlFromMetadata(primary, { variants: { w640: "https://cdn.example/w.jpg" } }, "")).toBe(primary);
  });

  test("returns variant URL when key matches", () => {
    expect(
      pickResolvedUrlFromMetadata(primary, { variants: { w640: "https://cdn.example/w640.jpg" } }, "w640")
    ).toBe("https://cdn.example/w640.jpg");
  });

  test("falls back to primary when key missing or invalid", () => {
    expect(pickResolvedUrlFromMetadata(primary, { variants: {} }, "og")).toBe(primary);
    expect(
      pickResolvedUrlFromMetadata(primary, { variants: { og: "javascript:alert(1)" } }, "og")
    ).toBe(primary);
  });
});

/**
 * Preview vs published parity: comparison logic used in the editor to show
 * "Avviker fra publisert versjon" when draft body differs from prod body.
 */
import { describe, test, expect } from "vitest";
import { previewDiffersFromPublished } from "@/app/(backoffice)/backoffice/content/_components/previewParity";

describe("previewDiffersFromPublished", () => {
  test("returns false when current draft and published body have same blocks", () => {
    const body = JSON.stringify({
      version: 1,
      blocks: [
        { id: "a", type: "hero", data: { title: "Hei" } },
        { id: "b", type: "richText", data: {} },
      ],
    });
    const published = {
      version: 1,
      blocks: [
        { id: "a", type: "hero", data: { title: "Hei" } },
        { id: "b", type: "richText", data: {} },
      ],
    };
    expect(previewDiffersFromPublished(body, published)).toBe(false);
  });

  test("returns true when block order differs", () => {
    const body = JSON.stringify({
      blocks: [{ id: "a", type: "hero" }, { id: "b", type: "richText" }],
    });
    const published = {
      blocks: [{ id: "b", type: "richText" }, { id: "a", type: "hero" }],
    };
    expect(previewDiffersFromPublished(body, published)).toBe(true);
  });

  test("returns true when blocks differ (content)", () => {
    const body = JSON.stringify({
      blocks: [{ id: "a", type: "hero", data: { title: "Draft title" } }],
    });
    const published = {
      blocks: [{ id: "a", type: "hero", data: { title: "Published title" } }],
    };
    expect(previewDiffersFromPublished(body, published)).toBe(true);
  });

  test("returns true when draft has extra block", () => {
    const body = JSON.stringify({
      blocks: [
        { id: "a", type: "hero" },
        { id: "b", type: "richText" },
      ],
    });
    const published = { blocks: [{ id: "a", type: "hero" }] };
    expect(previewDiffersFromPublished(body, published)).toBe(true);
  });

  test("returns true when published has extra block", () => {
    const body = JSON.stringify({ blocks: [{ id: "a", type: "hero" }] });
    const published = {
      blocks: [
        { id: "a", type: "hero" },
        { id: "b", type: "richText" },
      ],
    };
    expect(previewDiffersFromPublished(body, published)).toBe(true);
  });

  test("returns true when current body is invalid JSON", () => {
    expect(previewDiffersFromPublished("not json", { blocks: [] })).toBe(true);
    expect(previewDiffersFromPublished("", { blocks: [] })).toBe(true);
  });

  test("returns false when both are empty blocks", () => {
    expect(previewDiffersFromPublished(JSON.stringify({ blocks: [] }), { blocks: [] })).toBe(false);
    expect(previewDiffersFromPublished(JSON.stringify({}), {})).toBe(false);
  });

  test("handles envelope shape (body with blocks + meta)", () => {
    const body = JSON.stringify({
      version: 1,
      blocks: [{ id: "x", type: "richText", data: {} }],
      meta: { foo: "bar" },
    });
    const published = {
      version: 1,
      blocks: [{ id: "x", type: "richText", data: {} }],
    };
    expect(previewDiffersFromPublished(body, published)).toBe(false);
  });
});

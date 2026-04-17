import { describe, expect, test } from "vitest";

import { mergeSeoFieldsIntoVariantBody } from "@/lib/cms/mergeSeoIntoVariantBody";

describe("mergeSeoFieldsIntoVariantBody", () => {
  test("merges seo into empty body", () => {
    const out = mergeSeoFieldsIntoVariantBody(undefined, {
      title: "Test – Lunchportalen",
      description: "Beskrivelse",
    });
    expect((out.meta as { seo?: { title?: string } }).seo?.title).toBe("Test – Lunchportalen");
    expect(out.blocks).toEqual([]);
  });

  test("preserves blocks and merges seo", () => {
    const out = mergeSeoFieldsIntoVariantBody(
      { version: 1, blocks: [{ id: "a", type: "hero" }] },
      { title: "Ny tittel" },
    );
    expect(Array.isArray(out.blocks)).toBe(true);
    expect((out.blocks as unknown[]).length).toBe(1);
    expect((out.meta as { seo?: { title?: string } }).seo?.title).toBe("Ny tittel");
  });
});

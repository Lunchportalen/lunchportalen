import { describe, expect, test } from "vitest";
import { buildEditorialFailClosedMetadata } from "@/lib/cms/public/editorialFailClosedMetadata";

describe("buildEditorialFailClosedMetadata", () => {
  test("marks non-indexable and avoids promotional copy", () => {
    const m = buildEditorialFailClosedMetadata("/kontakt", "seed-no-row");
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(String(m.title)).toBe("Lunchportalen");
    expect(String(m.description)).toContain("ikke tilgjengelig");
  });
});

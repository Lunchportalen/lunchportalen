import { describe, expect, it } from "vitest";

import {
  MEDIA_COLLECTION_STATUS_OPTIONS,
  SAFE_BULK_COPY_MEDIA_URLS,
} from "@/lib/cms/backofficeCollectionViewModel";

describe("backofficeCollectionViewModel (U22)", () => {
  it("exposes status filter options including all", () => {
    expect(MEDIA_COLLECTION_STATUS_OPTIONS.some((o) => o.value === "all")).toBe(true);
    expect(MEDIA_COLLECTION_STATUS_OPTIONS.length).toBeGreaterThanOrEqual(4);
  });

  it("bulk copy label mentions clipboard safety", () => {
    expect(SAFE_BULK_COPY_MEDIA_URLS.toLowerCase()).toContain("utklipp");
  });
});

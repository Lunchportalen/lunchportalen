import { describe, expect, it } from "vitest";

import { summarizeGovernanceFromVariantRows } from "@/lib/cms/contentGovernanceUsage";

describe("contentGovernanceUsage (U27)", () => {
  it("teller governed vs legacy og blokktyper", () => {
    const rows = [
      {
        page_id: "a",
        body: { documentType: "page", fields: {}, blocksBody: { version: 1, blocks: [{ type: "hero" }] } },
      },
      {
        page_id: "b",
        body: { version: 1, blocks: [{ type: "text" }] },
      },
    ];
    const s = summarizeGovernanceFromVariantRows(rows);
    expect(s.governedVariants).toBe(1);
    expect(s.legacyVariants).toBe(1);
    expect(s.governedAllowlistOk).toBeGreaterThanOrEqual(1);
    expect(s.byDocumentType.page).toBe(1);
    expect(s.legacyPageIds).toContain("b");
    expect(s.blockTypeCounts.hero).toBeGreaterThanOrEqual(1);
    expect(s.blockTypeCounts.text).toBeGreaterThanOrEqual(1);
  });

  it("dedupliserer legacy page-id i sample", () => {
    const rows = [
      { page_id: "x", body: { version: 1, blocks: [] } },
      { page_id: "x", body: { version: 1, blocks: [] } },
    ];
    const s = summarizeGovernanceFromVariantRows(rows);
    expect(s.legacyVariants).toBe(2);
    expect(s.legacyPageIds.filter((id) => id === "x").length).toBe(1);
  });
});

import { describe, expect, it } from "vitest";
import { getBaselineDocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";

describe("DocumentTypeStructureParity (U97B)", () => {
  it("kanonisk shape bruker allowedChildTypes (ikke competing truth)", () => {
    const compact = getBaselineDocumentTypeDefinition("compact_page");
    expect(compact).toBeDefined();
    expect(Array.isArray(compact!.allowedChildTypes)).toBe(true);
    expect("allowedChildren" in compact!).toBe(false);
  });

  it("struktur for root/child er definert for kjerne-typer", () => {
    const page = getBaselineDocumentTypeDefinition("page")!;
    const compact = getBaselineDocumentTypeDefinition("compact_page")!;
    const micro = getBaselineDocumentTypeDefinition("micro_landing")!;
    expect(page.allowAtRoot).toBe(true);
    expect(compact.allowAtRoot).toBe(true);
    expect(micro.allowAtRoot).toBe(false);
    expect(page.allowedChildTypes).toContain("compact_page");
    expect(compact.allowedChildTypes).toContain("micro_landing");
  });
});

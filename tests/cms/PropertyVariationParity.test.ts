import { describe, expect, it } from "vitest";
import { getBaselineDocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { getPropertyVariation } from "@/lib/cms/contentNodeEnvelope";

describe("PropertyVariationParity", () => {
  it("page document type declares invariant structure_key and culture body", () => {
    const page = getBaselineDocumentTypeDefinition("page");
    expect(page).toBeDefined();
    const sk = page!.properties.find((p) => p.alias === "structure_key");
    const body = page!.properties.find((p) => p.alias === "body");
    expect(getPropertyVariation(sk!)).toBe("invariant");
    expect(getPropertyVariation(body!)).toBe("culture");
  });
});

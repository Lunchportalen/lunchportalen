import { describe, expect, it } from "vitest";
import { parseBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { normalizeEditorFieldLayers } from "@/lib/cms/contentNodeEnvelope";
import { getBaselineDocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";

describe("VariantContentModelParity", () => {
  it("normalize splits invariant vs culture from envelope", () => {
    const doc = getBaselineDocumentTypeDefinition("page")!;
    const body = {
      documentType: "page",
      invariantFields: { structure_key: "x" },
      cultureFields: { intro_kicker: "nb-only" },
      blocksBody: { blocks: [] },
    };
    const { invariantFields, cultureFields } = normalizeEditorFieldLayers(body, doc);
    expect(invariantFields.structure_key).toBe("x");
    expect(cultureFields.intro_kicker).toBe("nb-only");
    const e = parseBodyEnvelope(body);
    expect(e.documentType).toBe("page");
  });
});

import { describe, expect, it } from "vitest";
import { mergeInvariantLayerIntoBody } from "@/lib/cms/variantInvariantPropagation";
import { getBaselineDocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { parseBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";

describe("VariantRuntimeEffectParity", () => {
  it("mergeInvariantLayerIntoBody updates only invariant keys allowed by schema", () => {
    const doc = getBaselineDocumentTypeDefinition("page")!;
    const existing = {
      documentType: "page",
      invariantFields: { structure_key: "old" },
      cultureFields: { intro_kicker: "k" },
      blocksBody: { blocks: [{ id: "1", type: "richText" }] },
    };
    const next = mergeInvariantLayerIntoBody(existing, { structure_key: "new", intro_kicker: "bad" }, doc);
    const e = parseBodyEnvelope(next);
    expect(e.invariantFields.structure_key).toBe("new");
    expect(e.cultureFields.intro_kicker).toBe("k");
  });
});

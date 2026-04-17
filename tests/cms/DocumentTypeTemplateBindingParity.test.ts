import { describe, expect, it } from "vitest";
import { listDocumentTemplateAliases } from "@/lib/cms/schema/documentTemplateDefinitions";
import { getBaselineDocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";

describe("DocumentTypeTemplateBindingParity (U97B)", () => {
  it("document type templates/defaultTemplate peker til template-katalogen", () => {
    const allTemplates = new Set(listDocumentTemplateAliases());
    for (const alias of ["page", "compact_page", "micro_landing"]) {
      const doc = getBaselineDocumentTypeDefinition(alias)!;
      for (const templateAlias of doc.templates) {
        expect(allTemplates.has(templateAlias)).toBe(true);
      }
      if (doc.defaultTemplate) {
        expect(doc.templates).toContain(doc.defaultTemplate);
      }
    }
  });
});

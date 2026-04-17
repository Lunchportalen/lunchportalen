/**
 * U96 — Property Type → Data Type-binding er eksplisitt per dokumenttype.
 */
import { describe, expect, it } from "vitest";
import { listBlockEditorDataTypeAliases, getBlockEditorDataType } from "@/lib/cms/blocks/blockEditorDataTypes";
import { listBaselineDocumentTypeDefinitions } from "@/lib/cms/schema/documentTypeDefinitions";

/** U98 — CMS scalar property editors (ikke block list). */
const CMS_SCALAR_DATA_TYPE_ALIASES = new Set(["cms_text_line", "cms_text_area"]);

describe("PropertyTypeBindingParity (U96)", () => {
  it("alle properties peker til kjente Block Editor Data Types eller CMS-scalar", () => {
    const dtAliases = new Set(listBlockEditorDataTypeAliases());
    for (const doc of listBaselineDocumentTypeDefinitions()) {
      for (const p of doc.properties) {
        expect(p.dataTypeAlias.trim(), `${doc.alias}.${p.alias}`).toBe(p.dataTypeAlias);
        if (CMS_SCALAR_DATA_TYPE_ALIASES.has(p.dataTypeAlias)) {
          continue;
        }
        expect(dtAliases.has(p.dataTypeAlias), `${doc.alias}.${p.alias} → ${p.dataTypeAlias}`).toBe(true);
        const row = getBlockEditorDataType(p.dataTypeAlias);
        expect(row?.alias).toBe(p.dataTypeAlias);
      }
    }
  });
});

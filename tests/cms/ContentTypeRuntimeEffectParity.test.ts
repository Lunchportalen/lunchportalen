/**
 * U96 — Merge av Document Type overrides endrer effektiv schema (runtime-lag).
 */
import { describe, expect, it } from "vitest";
import { getBlockEditorDataTypeForDocument } from "@/lib/cms/blocks/blockEditorDataTypes";
import { mergeAllDocumentTypesWithOverrides } from "@/lib/cms/schema/documentTypeDefinitionMerge";

describe("ContentTypeRuntimeEffectParity (U96)", () => {
  it("admin override på property-tittel og gruppetittel slår inn i merged document type", () => {
    const merged = mergeAllDocumentTypesWithOverrides({
      version: 1,
      byAlias: {
        compact_page: {
          groups: { content: { title: "U96-test gruppe" } },
          properties: { body: { title: "U96-test body-tittel", description: "U96-test beskrivelse" } },
        },
      },
    });
    const doc = merged.compact_page;
    expect(doc).toBeDefined();
    expect(doc.groups.find((g) => g.id === "content")?.title).toBe("U96-test gruppe");
    const body = doc.properties.find((p) => p.alias === "body");
    expect(body?.title).toBe("U96-test body-tittel");
    expect(body?.description).toBe("U96-test beskrivelse");
  });

  it("bytte av body dataTypeAlias på merged document type styrer hvilken data type editoren resolver", () => {
    const merged = mergeAllDocumentTypesWithOverrides({
      version: 1,
      byAlias: {
        compact_page: {
          properties: { body: { dataTypeAlias: "page_micro_blocks" } },
        },
      },
    });
    const dt = getBlockEditorDataTypeForDocument("compact_page", null, merged);
    expect(dt?.alias).toBe("page_micro_blocks");
  });
});

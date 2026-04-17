/**
 * U96 — Tre lag: Document Type (side-schema), Data Type (block list config), Element Type (block shape).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  listBlockEditorDataTypeDefinitions,
  getAllowedElementTypeAliasesForDataType,
} from "@/lib/cms/blocks/blockEditorDataTypes";
import { BLOCK_TYPE_DEFINITION_BY_ALIAS } from "@/lib/cms/blocks/blockTypeDefinitions";
import {
  listBaselineDocumentTypeDefinitions,
  listDocumentTypeAliases,
} from "@/lib/cms/schema/documentTypeDefinitions";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = join(__dirname, "..", "..");

describe("DocumentTypeVsDataTypeVsElementTypeParity (U96)", () => {
  it("documentTypeDefinitions.ts importerer ikke blockEditorDataTypes eller blockTypeDefinitions", () => {
    const src = readFileSync(join(repoRoot, "lib", "cms", "schema", "documentTypeDefinitions.ts"), "utf-8");
    expect(src).not.toMatch(/blockEditorDataTypes/);
    expect(src).not.toMatch(/blockTypeDefinitions/);
  });

  it("elementTypeDefinitions.ts wrapper blockTypeDefinitions, ikke data types", () => {
    const src = readFileSync(join(repoRoot, "lib", "cms", "schema", "elementTypeDefinitions.ts"), "utf-8");
    expect(src).toMatch(/blockTypeDefinitions/);
    expect(src).not.toMatch(/blockEditorDataTypes/);
  });

  it("alle data type allowlist-alias finnes som block/element definition", () => {
    for (const dt of listBlockEditorDataTypeDefinitions()) {
      for (const alias of getAllowedElementTypeAliasesForDataType(dt)) {
        expect(BLOCK_TYPE_DEFINITION_BY_ALIAS[alias], `${dt.alias} → ${alias}`).toBeDefined();
      }
    }
  });

  it("document type-alias og block editor data type-alias er ikke samme nøkkel (løs kobling via property)", () => {
    for (const doc of listBaselineDocumentTypeDefinitions()) {
      const body = doc.properties.find((p) => p.alias === "body");
      expect(body?.dataTypeAlias).toBeTruthy();
    }
    const docAliasSet = new Set(listDocumentTypeAliases());
    for (const dt of listBlockEditorDataTypeDefinitions()) {
      expect(
        docAliasSet.has(dt.alias),
        `data type ${dt.alias} skal ikke bruke samme alias som en document type`,
      ).toBe(false);
    }
  });
});

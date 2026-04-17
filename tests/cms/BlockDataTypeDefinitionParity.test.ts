/**
 * U94 — Block Editor Data Type definitions are canonical and structurally complete.
 */
import { describe, expect, it } from "vitest";
import {
  listBlockEditorDataTypeDefinitions,
  type BlockEditorDataTypeDefinition,
} from "@/lib/cms/blocks/blockEditorDataTypes";

function assertCanonical(dt: BlockEditorDataTypeDefinition) {
  expect(dt.alias.trim()).toBe(dt.alias);
  expect(dt.alias.length).toBeGreaterThan(0);
  expect(dt.title.trim().length).toBeGreaterThan(0);
  expect(dt.description.trim().length).toBeGreaterThan(10);
  expect(dt.propertyKey).toBe("body.blocks");
  expect(["block_list", "block_grid"]).toContain(dt.editorKind);
  expect(Array.isArray(dt.allowedBlockAliases)).toBe(true);
  expect(dt.allowedBlockAliases.length).toBeGreaterThan(0);
  for (const a of dt.allowedBlockAliases) {
    expect(String(a).trim()).toBe(a);
  }
  expect(Array.isArray(dt.groups)).toBe(true);
  for (const g of dt.groups) {
    expect(g.id.trim()).toBe(g.id);
    expect(g.title.trim().length).toBeGreaterThan(0);
    expect(Array.isArray(g.blockAliases)).toBe(true);
    for (const b of g.blockAliases) {
      expect(dt.allowedBlockAliases).toContain(b);
    }
  }
  expect(dt.minItems).toBeGreaterThanOrEqual(0);
  expect(dt.maxItems).toBeGreaterThanOrEqual(dt.minItems);
  expect(dt.createButtonLabel.trim().length).toBeGreaterThan(0);
  expect(dt.editorOptions).toBeTypeOf("object");
}

describe("BlockDataTypeDefinitionParity (U94)", () => {
  it("alle data type-definisjoner er kanoniske og unike på alias", () => {
    const all = listBlockEditorDataTypeDefinitions();
    expect(all.length).toBeGreaterThanOrEqual(3);
    const aliases = new Set<string>();
    for (const dt of all) {
      assertCanonical(dt);
      expect(aliases.has(dt.alias)).toBe(false);
      aliases.add(dt.alias);
    }
  });

  it("forventede U94-alias finnes", () => {
    const aliases = listBlockEditorDataTypeDefinitions().map((d) => d.alias);
    expect(aliases).toContain("page_marketing_blocks");
    expect(aliases).toContain("compact_page_blocks");
    expect(aliases).toContain("page_micro_blocks");
  });
});

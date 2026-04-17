/**
 * U87: Én kanonisk block type definition — katalog, editor, canvas, defaults, preview, validation.
 */
import { describe, expect, it } from "vitest";
import {
  BLOCK_TYPE_DEFINITION_BY_ALIAS,
  CANVAS_VIEW_COMPONENT_BY_ALIAS,
  CORE_CMS_BLOCK_DEFINITIONS,
  KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS,
  PROPERTY_EDITOR_COMPONENT_BY_ALIAS,
  getBlockTypeDefinition,
} from "@/lib/cms/blocks/blockTypeDefinitions";
import { createBackofficeBlockDraft, getBackofficeBlockCatalog } from "@/lib/cms/backofficeBlockCatalog";

describe("BlockTypeDefinitionSingleSource (U87)", () => {
  it("nøkkelblokker har én kanonisk definisjon i BLOCK_TYPE_DEFINITION_BY_ALIAS", () => {
    for (const alias of KEY_BLOCK_ALIASES_FOR_CONTRACT_TESTS) {
      const d = getBlockTypeDefinition(alias);
      expect(d, alias).toBeTruthy();
      expect(d!.alias).toBe(alias);
      expect(d!.title.trim().length).toBeGreaterThan(2);
      expect(d!.whenToUse.trim().length).toBeGreaterThan(24);
      expect(d!.propertyEditorComponent).toMatch(/PropertyEditor$/);
      expect(d!.canvasViewComponent).toMatch(/CanvasFrame$/);
      expect(PROPERTY_EDITOR_COMPONENT_BY_ALIAS[alias]).toBe(d!.propertyEditorComponent);
      expect(CANVAS_VIEW_COMPONENT_BY_ALIAS[alias]).toBe(d!.canvasViewComponent);
    }
  });

  it("CORE_CMS_BLOCK_DEFINITIONS er avledet av samme kanon (label, description, defaults, previewText)", () => {
    for (const row of CORE_CMS_BLOCK_DEFINITIONS) {
      const d = getBlockTypeDefinition(row.type);
      expect(d, row.type).toBeTruthy();
      expect(row.label).toBe(d!.title);
      expect(row.description).toBe(d!.description);
      expect(row.defaults()).toEqual(d!.defaultsFactory());
      const sample = d!.defaultsFactory();
      expect(row.previewText?.(sample)).toBe(d!.previewSummaryBuilder(sample));
    }
  });

  it("backoffice-katalog speiler kanoniske felt (ikke parallelle labels)", () => {
    const catalog = getBackofficeBlockCatalog();
    for (const entry of catalog) {
      const d = getBlockTypeDefinition(entry.type);
      expect(d, entry.type).toBeTruthy();
      expect(entry.label).toBe(d!.title);
      expect(entry.shortTitle).toBe(d!.shortTitle);
      expect(entry.whenToUse).toBe(d!.whenToUse);
      expect(entry.libraryGroup).toBe(d!.libraryGroup);
      expect(entry.propertyEditorComponent).toBe(d!.propertyEditorComponent);
      expect(entry.canvasViewComponent).toBe(d!.canvasViewComponent);
    }
  });

  it("createBackofficeBlockDraft bruker samme defaults som defaultsFactory", () => {
    for (const alias of ["hero", "cards", "pricing", "relatedLinks"] as const) {
      const d = getBlockTypeDefinition(alias)!;
      const draft = createBackofficeBlockDraft(alias);
      expect(draft).toBeTruthy();
      const { type: _t, ...rest } = draft as Record<string, unknown>;
      expect(rest).toEqual(d.defaultsFactory());
    }
  });
});

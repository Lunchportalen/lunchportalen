/**
 * U96 — Kanoniske Document Type-definisjoner (alias, grupper, properties).
 */
import { describe, expect, it } from "vitest";
import {
  getBaselineDocumentTypeDefinition,
  listBaselineDocumentTypeDefinitions,
  listDocumentTypeAliases,
} from "@/lib/cms/schema/documentTypeDefinitions";

describe("ContentTypeDefinitionParity (U96)", () => {
  it("baseline document types finnes som kanoniske definisjoner", () => {
    const aliases = listDocumentTypeAliases();
    expect(aliases).toContain("page");
    expect(aliases).toContain("compact_page");
    expect(aliases).toContain("micro_landing");
    expect(listBaselineDocumentTypeDefinitions().length).toBeGreaterThanOrEqual(3);
  });

  it("hver document type har grupper og minst én property med body", () => {
    for (const alias of listDocumentTypeAliases()) {
      const d = getBaselineDocumentTypeDefinition(alias);
      expect(d, alias).toBeDefined();
      expect(d!.groups.length).toBeGreaterThan(0);
      expect(d!.properties.some((p) => p.alias === "body")).toBe(true);
      expect(d!.title.trim().length).toBeGreaterThan(0);
      expect(d!.description.trim().length).toBeGreaterThan(0);
    }
  });
});

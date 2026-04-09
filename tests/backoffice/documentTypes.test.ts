/**
 * Schema-driven document type registry: documentTypes and getDocType.
 * Used by content editor for create panel and envelope/field rendering.
 */
import { describe, test, expect } from "vitest";
import {
  documentTypes,
  getDocType,
  type DocumentTypeEntry,
} from "@/lib/cms/contentDocumentTypes";

describe("documentTypes – schema shape", () => {
  test("documentTypes is non-empty array", () => {
    expect(Array.isArray(documentTypes)).toBe(true);
    expect(documentTypes.length).toBeGreaterThan(0);
  });

  test("each entry has alias and name (required for field rendering)", () => {
    for (const d of documentTypes as DocumentTypeEntry[]) {
      expect(typeof d.alias).toBe("string");
      expect(d.alias.length).toBeGreaterThan(0);
      expect(typeof d.name).toBe("string");
      expect(d.name.length).toBeGreaterThan(0);
    }
  });

  test("allowedChildren when present is array of strings", () => {
    for (const d of documentTypes as DocumentTypeEntry[]) {
      if (d.allowedChildren != null) {
        expect(Array.isArray(d.allowedChildren)).toBe(true);
        (d.allowedChildren as string[]).forEach((c) => {
          expect(typeof c).toBe("string");
        });
      }
    }
  });

  test("allowedBlockTypes when present is array of strings (U24)", () => {
    for (const d of documentTypes as DocumentTypeEntry[]) {
      if (d.allowedBlockTypes != null) {
        expect(Array.isArray(d.allowedBlockTypes)).toBe(true);
        expect(d.allowedBlockTypes!.length).toBeGreaterThan(0);
        (d.allowedBlockTypes as string[]).forEach((c) => {
          expect(typeof c).toBe("string");
        });
      }
    }
  });
});

describe("getDocType – schema-driven lookup", () => {
  test("returns entry when alias exists", () => {
    const page = getDocType("page");
    expect(page).not.toBeNull();
    expect(page?.alias).toBe("page");
    expect(page?.name).toBe("Page");
  });

  test("returns null for unknown alias", () => {
    expect(getDocType("unknownType")).toBeNull();
    expect(getDocType("")).toBeNull();
  });

  test("returned entry matches documentTypes element (single source of truth)", () => {
    const fromGet = getDocType("page");
    const fromList = documentTypes.find((d) => d.alias === "page");
    expect(fromGet).toEqual(fromList);
  });
});

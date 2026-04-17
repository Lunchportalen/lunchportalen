import { describe, test, expect } from "vitest";
import {
  mapTreeApiRootsToContentNodes,
  parseTreeFetchEnvelope,
  parseTreeRootsFromJsonResponse,
} from "@/app/(backoffice)/backoffice/content/_tree/mapTreeApiRoots";

describe("mapTreeApiRoots", () => {
  test("maps API roots recursively with treeSortOrder", () => {
    const roots = mapTreeApiRootsToContentNodes([
      {
        id: "overlays",
        parentId: null,
        name: "App overlays",
        hasChildren: true,
        icon: "folder",
        nodeType: "folder",
        children: [
          {
            id: "p1",
            parentId: "overlays",
            name: "Side",
            slug: "side",
            hasChildren: false,
            icon: "document",
            nodeType: "page",
            treeSortOrder: 3,
          },
        ],
      },
    ]);
    expect(roots[0]?.id).toBe("overlays");
    expect(roots[0]?.children?.[0]?.treeSortOrder).toBe(3);
  });

  test("parseTreeRootsFromJsonResponse reads jsonOk envelope", () => {
    const roots = parseTreeRootsFromJsonResponse({
      ok: true,
      rid: "r1",
      data: {
        roots: [{ id: "global", parentId: null, name: "Global", hasChildren: false, icon: "folder", nodeType: "folder" }],
      },
    });
    expect(roots).toHaveLength(1);
    expect(roots[0]?.id).toBe("global");
  });

  test("parseTreeRootsFromJsonResponse returns empty on failure", () => {
    expect(parseTreeRootsFromJsonResponse({ ok: false })).toEqual([]);
  });

  test("parseTreeFetchEnvelope exposes degraded + schema hint for page_key fallback", () => {
    const env = parseTreeFetchEnvelope({
      ok: true,
      rid: "r",
      data: {
        roots: [],
        degraded: false,
        schemaHints: { pageKeyColumnMissing: true, pageKeyInferredFromSlug: true },
      },
    });
    expect(env.degraded).toBe(false);
    expect(env.mutationsLocked).toBe(false);
    expect(env.schemaHint).toContain("page_key");
  });

  test("parseTreeFetchEnvelope maps table-unavailable degraded reason", () => {
    const env = parseTreeFetchEnvelope({
      ok: true,
      data: {
        roots: [{ id: "home", parentId: null, name: "Hjem", hasChildren: false }],
        degraded: true,
        reason: "TABLE_OR_CONTENT_PAGES_UNAVAILABLE",
      },
    });
    expect(env.degraded).toBe(true);
    expect(env.mutationsLocked).toBe(true);
    expect(env.schemaHint).toContain("content_pages");
  });

  test("parseTreeFetchEnvelope maps missing tree columns to an operator hint", () => {
    const env = parseTreeFetchEnvelope({
      ok: true,
      data: {
        roots: [{ id: "overlays", parentId: null, name: "Overlays", hasChildren: false }],
        degraded: true,
        reason: "TREE_COLUMNS_MISSING",
        schemaHints: { treeColumnsMissing: true, missingColumns: ["tree_parent_id", "tree_root_key"], code: "42703" },
      },
    });
    expect(env.degraded).toBe(true);
    expect(env.mutationsLocked).toBe(true);
    expect(env.schemaHint).toContain("Tree-kolonner");
    expect(env.missingColumns).toEqual(["tree_parent_id", "tree_root_key"]);
    expect(env.technicalCode).toBe("42703");
  });

  test("parseTreeFetchEnvelope keeps operatorMessage, hint, and technical detail separate", () => {
    const env = parseTreeFetchEnvelope({
      ok: true,
      data: {
        roots: [],
        degraded: true,
        reason: "SCHEMA_OR_CACHE_UNAVAILABLE",
        operatorMessage: "Content-treet er degradert fordi schema/cache hindret full lesing.",
        schemaHints: { queryFailed: true, detail: "schema cache missing relation content_pages" },
      },
    });

    expect(env.degraded).toBe(true);
    expect(env.mutationsLocked).toBe(true);
    expect(env.operatorMessage).toContain("schema/cache");
    expect(env.schemaHint).toContain("Tre-API");
    expect(env.technicalDetail).toContain("schema cache");
  });

  test("parseTreeFetchEnvelope exposes explicit page_key fallback column names", () => {
    const env = parseTreeFetchEnvelope({
      ok: true,
      data: {
        roots: [],
        degraded: false,
        schemaHints: {
          pageKeyColumnMissing: true,
          pageKeyInferredFromSlug: true,
          missingColumns: ["page_key"],
        },
      },
    });

    expect(env.schemaHint).toContain("page_key");
    expect(env.missingColumns).toEqual(["page_key"]);
  });
});

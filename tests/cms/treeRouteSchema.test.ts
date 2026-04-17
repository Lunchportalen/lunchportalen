import { describe, expect, test } from "vitest";
import {
  isTreeRouteDegradableSchemaError,
  isTreeRouteMissingTableError,
  resolveTreeRouteSchemaIssue,
} from "@/lib/cms/treeRouteSchema";

describe("isTreeRouteDegradableSchemaError", () => {
  test("returns true for undefined_column", () => {
    expect(isTreeRouteDegradableSchemaError({ code: "42703", message: "column x does not exist" })).toBe(true);
  });

  test("returns true for PostgREST schema cache", () => {
    expect(isTreeRouteDegradableSchemaError({ code: "PGRST204", message: "schema cache" })).toBe(true);
  });

  test("returns false for unrelated errors", () => {
    expect(isTreeRouteDegradableSchemaError(new Error("network"))).toBe(false);
  });
});

describe("resolveTreeRouteSchemaIssue", () => {
  test("classifies page_key fallback with explicit missing column", () => {
    const issue = resolveTreeRouteSchemaIssue({
      code: "42703",
      message: "column content_pages.page_key does not exist",
    });

    expect(issue?.reason).toBe("PAGE_KEY_COLUMN_MISSING");
    expect(issue?.schemaHints.pageKeyColumnMissing).toBe(true);
    expect(issue?.schemaHints.missingColumns).toEqual(["page_key"]);
  });

  test("classifies missing tree columns with operator-safe detail", () => {
    const issue = resolveTreeRouteSchemaIssue({
      code: "42703",
      message: "column content_pages.tree_parent_id does not exist",
    });

    expect(issue?.reason).toBe("TREE_COLUMNS_MISSING");
    expect(issue?.schemaHints.treeColumnsMissing).toBe(true);
    expect(issue?.schemaHints.missingColumns).toEqual(["tree_parent_id"]);
    expect(issue?.operatorAction).toContain("tree_parent_id");
  });

  test("classifies missing content_pages table separately from generic schema drift", () => {
    const error = {
      code: "42P01",
      message: 'relation "content_pages" does not exist',
    };

    expect(isTreeRouteMissingTableError(error)).toBe(true);
    expect(resolveTreeRouteSchemaIssue(error)?.reason).toBe("TABLE_OR_CONTENT_PAGES_UNAVAILABLE");
  });
});

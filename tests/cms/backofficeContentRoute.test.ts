import { describe, expect, test } from "vitest";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";

describe("backofficeContentRoute", () => {
  test("parses overview route as section landing", () => {
    expect(resolveBackofficeContentRoute("/backoffice/content")).toEqual({
      normalizedPathname: "/backoffice/content",
      kind: "overview",
      entityId: null,
      selectedNodeId: null,
      sectionView: "overview",
      isSectionView: true,
    });
  });

  test("parses detail route as entity workspace", () => {
    const route = resolveBackofficeContentRoute(
      "/backoffice/content/123e4567-e89b-12d3-a456-426614174000",
    );

    expect(route.kind).toBe("detail");
    expect(route.entityId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(route.selectedNodeId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(route.isSectionView).toBe(false);
  });

  test("parses recycle bin as section workspace", () => {
    const route = resolveBackofficeContentRoute("/backoffice/content/recycle-bin/");

    expect(route.kind).toBe("recycle-bin");
    expect(route.sectionView).toBe("recycle-bin");
    expect(route.entityId).toBeNull();
    expect(route.isSectionView).toBe(true);
  });
});

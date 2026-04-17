import { describe, expect, it } from "vitest";
import type { ContentTreeNode } from "@/app/(backoffice)/backoffice/content/_tree/treeTypes";
import {
  expandRevealIdsForPostCreate,
  findNode,
} from "@/app/(backoffice)/backoffice/content/_tree/treeMock";

function pageNode(
  id: string,
  parentId: string | null,
  name: string,
  children?: ContentTreeNode[],
): ContentTreeNode {
  return {
    id,
    parentId,
    name,
    hasChildren: Boolean(children?.length),
    children,
    nodeType: "page",
    kind: "page",
  };
}

describe("PostCreateTreeRevealParity (U97F)", () => {
  it("utvider til ny node via id når den finnes i treet", () => {
    const child = pageNode("child-uuid", "parent-uuid", "Child");
    const parent = pageNode("parent-uuid", "root-folder", "Parent", [child]);
    const roots: ContentTreeNode[] = [
      {
        id: "root-folder",
        parentId: null,
        name: "Overlays",
        hasChildren: true,
        nodeType: "folder",
        children: [parent],
      },
    ];
    const reveal = expandRevealIdsForPostCreate(roots, "child-uuid", "parent-uuid");
    expect(reveal).toContain("root-folder");
    expect(reveal).toContain("parent-uuid");
    expect(findNode(roots, "child-uuid")?.id).toBe("child-uuid");
  });

  it("fallback: utvider til kjent forelder når barn ikke er synlig i treet ennå (API-lag)", () => {
    const parent = pageNode("parent-uuid", "root-folder", "Parent", []);
    const roots: ContentTreeNode[] = [
      {
        id: "root-folder",
        parentId: null,
        name: "Overlays",
        hasChildren: true,
        nodeType: "folder",
        children: [parent],
      },
    ];
    const reveal = expandRevealIdsForPostCreate(roots, "new-child-uuid", "parent-uuid");
    expect(reveal).toContain("root-folder");
    expect(reveal).toContain("parent-uuid");
  });
});

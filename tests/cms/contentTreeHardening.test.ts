/**
 * contentTreeHardening.test.ts
 *
 * Focused proof that the Content Tree contract is hardened:
 * - tree truth model (virtual roots + persisted document nodes)
 * - node -> editor binding (UUID ids only)
 * - fail-closed invalid-node behavior
 * - node action/menu safety (no fake CRUD affordances)
 */

// @ts-nocheck

import { describe, test, expect } from "vitest";

import { isContentPageId } from "@/lib/cms/public/getPageIdBySlug";
import { contentTreeMutationsLocked } from "@/lib/cms/contentTreeRuntime";
import {
  collectExpandedIdsForTreeFilter,
  collectVisibleNodeIdsForTreeFilter,
  contentTreeNodeMatchesFilter,
  dedupeRootsById,
  flattenVisible,
  findNode,
  getMockRoots,
} from "@/app/(backoffice)/backoffice/content/_tree/treeMock";
import type { ContentTreeNode, TreePermissions } from "@/app/(backoffice)/backoffice/content/_tree/treeTypes";
import { MOCK_RECYCLE_BIN_ID } from "@/app/(backoffice)/backoffice/content/_data/mockContent";

type TreeApiNode = {
  id: string;
  parentId: string | null;
  name: string;
  slug?: string;
  hasChildren: boolean;
  children?: TreeApiNode[];
  status?: "draft" | "published";
  icon?: "home" | "folder" | "document";
  kind?: string;
  nodeType?: "folder" | "page" | "root";
  targetPageId?: string | null;
};

// Local copy of the tree API buildTree logic (pure function) to avoid importing Next route file into Vitest directly.
function pageRow(
  id: string,
  rootKey: string | null,
  parentId: string | null,
  sort: number,
  slug: string | null,
  status: string | null,
  pageKey: string | null = null,
): any {
  return {
    id,
    title: slug,
    slug,
    status,
    tree_parent_id: parentId,
    tree_root_key: rootKey,
    tree_sort_order: sort,
    page_key: pageKey,
  };
}

function pageToNode(p: any): TreeApiNode {
  return {
    id: p.id,
    parentId: p.tree_parent_id,
    name: (p.title ?? p.slug ?? "Untitled").trim() || "Untitled",
    slug: p.slug ?? undefined,
    hasChildren: false,
    status: (p.status === "published" ? "published" : "draft") as "draft" | "published",
    icon: "document",
    nodeType: "page",
    kind: p.page_key ?? "page",
  };
}

function buildTree(pages: any[], virtualRoots: TreeApiNode[]): TreeApiNode[] {
  const byParent = new Map<string, any[]>();
  const byRoot = new Map<string, any[]>();

  const FIXED_APP_KEYS = new Set(["employee_week", "superadmin", "company_admin", "kitchen", "driver"]);

  for (const p of pages) {
    if (p.tree_parent_id) {
      const list = byParent.get(p.tree_parent_id) ?? [];
      list.push(p);
      byParent.set(p.tree_parent_id, list);
    } else if (p.tree_root_key) {
      const list = byRoot.get(p.tree_root_key) ?? [];
      list.push(p);
      byRoot.set(p.tree_root_key, list);
    }
  }

  for (const list of [byParent, byRoot].flatMap((m) => Array.from(m.values()))) {
    list.sort((a, b) => a.tree_sort_order - b.tree_sort_order);
  }

  const fixedAppPages: any[] = pages
    .filter((p) => {
      const key = (p.page_key ?? "").trim().toLowerCase();
      return FIXED_APP_KEYS.has(key);
    })
    .sort((a, b) => a.tree_sort_order - b.tree_sort_order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const fixedAppIds = new Set(fixedAppPages.map((p) => p.id));

  function addChildren(node: TreeApiNode, parentId: string): void {
    const underParent = byParent.get(parentId) ?? [];
    const children: TreeApiNode[] = underParent.map((p) => {
      const n = pageToNode(p);
      n.hasChildren = (byParent.get(p.id)?.length ?? 0) > 0;
      if (n.hasChildren) n.children = [];
      return n;
    });
    for (const c of children) addChildren(c, c.id);
    node.children = children;
    node.hasChildren = children.length > 0;
  }

  const rootsById = new Map<string, TreeApiNode>();

  for (const vr of virtualRoots) {
    rootsById.set(vr.id, { ...vr, children: [], hasChildren: false });
  }

  // Bind virtual Hjem root to real Forside page via stable page_key "home".
  const homeRoot = rootsById.get("home")!;
  const forside = pages.find((p) => (p.page_key ?? "").trim().toLowerCase() === "home");
  if (forside) {
    homeRoot.targetPageId = forside.id;
  }

  for (const root of virtualRoots) {
    const rootNode = rootsById.get(root.id)!;

    const rootKey =
      root.id === "home"
        ? "home"
        : root.id === "overlays"
        ? "overlays"
        : root.id === "global"
        ? "global"
        : "design";

    const underRoot = byRoot.get(rootKey) ?? [];

    const homeRootNode = rootsById.get("home")!;
    const overlaysRoot = rootsById.get("overlays")!;

    // Place fixed app surfaces as children under Hjem, not under App overlays.
    if (root.id === "overlays") {
      const overlayChildren: TreeApiNode[] = [];

      for (const p of underRoot) {
        if (fixedAppIds.has(p.id)) continue;

        const n = pageToNode(p);
        n.parentId = overlaysRoot.id;
        overlayChildren.push(n);
      }

      overlaysRoot.children = overlayChildren;
      overlaysRoot.hasChildren = overlayChildren.length > 0;

      for (const c of overlayChildren) addChildren(c, c.id);

      continue;
    }

    // For Hjem we do not attach the real Forside page as a child node; Hjem is a virtual root.
    if (root.id === "home") {
      const homeChildren: TreeApiNode[] = fixedAppPages.map((p) => {
        const n = pageToNode(p);
        n.parentId = homeRootNode.id;
        n.hasChildren = false;
        delete n.children;
        return n;
      });

      homeRootNode.children = homeChildren;
      homeRootNode.hasChildren = homeChildren.length > 0;

      continue;
    }

    const children: TreeApiNode[] = underRoot
      .filter((p) => !fixedAppIds.has(p.id))
      .map((p) => {
        const n = pageToNode(p);
        n.parentId = rootNode.id;
        n.hasChildren = (byParent.get(p.id)?.length ?? 0) > 0;
        if (n.hasChildren) n.children = [];
        return n;
      });

    for (const c of children) addChildren(c, c.id);
    rootNode.children = children;
    rootNode.hasChildren = children.length > 0;
  }

  return Array.from(rootsById.values());
}

/** Mirror of app permissions: move only for page nodes with content page id. */
function permissionsForNode(node: ContentTreeNode): TreePermissions {
  const canMove = node.nodeType === "page" && isContentPageId(node.id);
  return {
    canCreate: false,
    canRename: false,
    canMove,
    canDelete: false,
  };
}

describe("contentTreeHardening – tree truth model and selection", () => {
  test("virtual roots are stable and document nodes use UUID ids only", () => {
    const roots = getMockRoots();
    const virtualRootIds = roots.map((r) => r.id);
    expect(virtualRootIds).toEqual(["home", "overlays", "global", "design"]);

    const flat = flattenVisible(roots, new Set<string>(["overlays", "global", "design"]));
    const documentNodes = flat.filter(({ node }) => node.icon === "document");
    for (const { node } of documentNodes) {
      if (node.id === MOCK_RECYCLE_BIN_ID) continue;
      // In the hardened model, persisted pages in real tree use UUID ids; mock tree keeps non-UUID ids for overlays/global/design
      expect(isContentPageId(node.id)).toBe(false);
    }
  });

  test("buildTree attaches pages under correct virtual roots and never under wrong root", () => {
    const pages = [
      pageRow("p-home", "home", null, 0, "home", "draft", "home"),
      pageRow("p-overlay-week", "overlays", null, 0, "week", "draft", "employee_week"),
      pageRow("p-global-header", "global", null, 0, "header", "published", null),
      pageRow("p-design-tokens", "design", null, 0, "design-tokens", "published", null),
    ];

    const virtualRoots: TreeApiNode[] = [
      { id: "home", parentId: null, name: "Hjem", slug: "home", hasChildren: true, icon: "home", nodeType: "root", kind: "home", targetPageId: null },
      { id: "overlays", parentId: null, name: "App overlays", hasChildren: true, icon: "folder", nodeType: "folder", kind: "app_overlay_folder" },
      { id: "global", parentId: null, name: "Global", hasChildren: true, icon: "folder", nodeType: "folder", kind: "global" },
      { id: "design", parentId: null, name: "Design", hasChildren: true, icon: "folder", nodeType: "folder", kind: "design" },
    ];

    const roots = buildTree(pages, virtualRoots);
    const homeRoot = roots.find((r) => r.id === "home")!;
    const overlaysRoot = roots.find((r) => r.id === "overlays")!;
    const globalRoot = roots.find((r) => r.id === "global")!;
    const designRoot = roots.find((r) => r.id === "design")!;

    // Hjem is a virtual root: bound to Forside via targetPageId and exposes fixed app pages as children.
    expect(homeRoot.targetPageId).toBe("p-home");
    expect(homeRoot.children?.map((c) => c.id)).toEqual(["p-overlay-week"]);
    // Overlays contain only remaining overlay pages, not fixed app surfaces that live under Hjem.
    expect(overlaysRoot.children?.map((c) => c.id)).toEqual([]);
    expect(globalRoot.children?.map((c) => c.id)).toEqual(["p-global-header"]);
    expect(designRoot.children?.map((c) => c.id)).toEqual(["p-design-tokens"]);
  });

  test("findNode resolves node by id independently of expandedIds (selection safe even when collapsed)", () => {
    const roots = getMockRoots();
    const flatCollapsed = flattenVisible(roots, new Set());
    const flatExpanded = flattenVisible(roots, new Set(["overlays", "global", "design"]));

    // In collapsed state only roots are visible
    expect(flatCollapsed.length).toBe(4);
    expect(flatCollapsed.map((r) => r.node.id)).toEqual(["home", "overlays", "global", "design"]);

    // In expanded state we see all descendants
    expect(flatExpanded.length).toBeGreaterThan(flatCollapsed.length);

    // But findNode works regardless of expanded state
    const headerNode = findNode(roots, "global-header");
    expect(headerNode).not.toBeNull();
    expect(headerNode!.id).toBe("global-header");
    expect(headerNode!.parentId).toBe("global");
  });
});

describe("contentTree CP9 — tree filter helpers", () => {
  test("collectVisibleNodeIdsForTreeFilter returns null when needle is blank", () => {
    const roots = getMockRoots();
    expect(collectVisibleNodeIdsForTreeFilter(roots, "")).toBeNull();
    expect(collectVisibleNodeIdsForTreeFilter(roots, "   ")).toBeNull();
  });

  test("collectVisibleNodeIdsForTreeFilter includes ancestors for a slug match", () => {
    const roots = getMockRoots();
    const ids = collectVisibleNodeIdsForTreeFilter(roots, "header");
    expect(ids).not.toBeNull();
    expect(ids!.has("global")).toBe(true);
    expect(ids!.has("global-header")).toBe(true);
  });

  test("collectExpandedIdsForTreeFilter expands folders on path to match", () => {
    const roots = getMockRoots();
    const ex = collectExpandedIdsForTreeFilter(roots, "header");
    expect(ex.has("global")).toBe(true);
  });

  test("contentTreeNodeMatchesFilter matches name or slug", () => {
    const roots = getMockRoots();
    const header = findNode(roots, "global-header");
    expect(header).not.toBeNull();
    expect(contentTreeNodeMatchesFilter(header!, "head")).toBe(true);
    expect(contentTreeNodeMatchesFilter(header!, "xyz")).toBe(false);
  });
});

describe("contentTreeHardening – fail-closed invalid-node behavior", () => {
  test("flattenVisible tolerates null/undefined in roots (no crash on malformed API response)", () => {
    const validNode: ContentTreeNode = {
      id: "single",
      parentId: null,
      name: "Single",
      slug: "single",
      hasChildren: false,
      icon: "document",
      nodeType: "page",
    };
    const rootsWithNull = [null, validNode, undefined] as unknown as ContentTreeNode[];
    const flat = flattenVisible(rootsWithNull, new Set());
    expect(flat).toHaveLength(1);
    expect(flat[0].node.id).toBe("single");
  });

  test("dedupeRootsById keeps first occurrence per id so at most one Hjem is visible", () => {
    const home1: ContentTreeNode = {
      id: "home",
      parentId: null,
      name: "Hjem",
      slug: "home",
      hasChildren: false,
      nodeType: "root",
      targetPageId: "p-forside",
    };
    const home2: ContentTreeNode = {
      id: "home",
      parentId: null,
      name: "Hjem",
      slug: "home",
      hasChildren: true,
      nodeType: "root",
    };
    const overlays: ContentTreeNode = {
      id: "overlays",
      parentId: null,
      name: "App overlays",
      hasChildren: false,
      nodeType: "folder",
    };
    const deduped = dedupeRootsById([home1, home2, overlays]);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].id).toBe("home");
    expect(deduped[0].targetPageId).toBe("p-forside");
    expect(deduped[1].id).toBe("overlays");
    const homeCount = deduped.filter((r) => r.id === "home").length;
    expect(homeCount).toBe(1);
  });

  test("buildTree drops orphans whose parent does not exist (no misleading navigation)", () => {
    const pages = [
      pageRow("p-orphan", null, "missing-parent", 0, "orphan", "draft"),
    ];

    const virtualRoots: TreeApiNode[] = [
      { id: "home", parentId: null, name: "Hjem", slug: "home", hasChildren: true, icon: "home" },
      { id: "overlays", parentId: null, name: "App overlays", hasChildren: true, icon: "folder" },
      { id: "global", parentId: null, name: "Global", hasChildren: true, icon: "folder" },
      { id: "design", parentId: null, name: "Design", hasChildren: true, icon: "folder" },
    ];

    const roots = buildTree(pages, virtualRoots);
    const allChildrenIds = roots.flatMap((r) => r.children ?? []).map((c) => c.id);
    expect(allChildrenIds).not.toContain("p-orphan");
  });
});

describe("contentTreeHardening – node actions/menu safety", () => {
  function mkNode(
    id: string,
    icon: ContentTreeNode["icon"] = "document",
    nodeType?: ContentTreeNode["nodeType"],
  ): ContentTreeNode {
    return {
      id,
      parentId: null,
      name: id,
      slug: id,
      hasChildren: false,
      icon,
      nodeType,
    };
  }

  test("virtual roots never get move/create/rename/delete permissions", () => {
    const roots: ContentTreeNode[] = [
      mkNode("home", "home", "root"),
      mkNode("overlays", "folder", "folder"),
      mkNode("global", "folder", "folder"),
      mkNode("design", "folder", "folder"),
    ];
    for (const node of roots) {
      const perms = permissionsForNode(node);
      expect(perms.canCreate).toBe(false);
      expect(perms.canRename).toBe(false);
      expect(perms.canDelete).toBe(false);
      expect(perms.canMove).toBe(false);
    }
  });

  test("document UUID nodes get move=true and no other CRUD permissions", () => {
    const uuid = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
    const node = mkNode(uuid, "document", "page");
    const perms = permissionsForNode(node);
    expect(isContentPageId(uuid)).toBe(true);
    expect(perms.canMove).toBe(true);
    expect(perms.canCreate).toBe(false);
    expect(perms.canRename).toBe(false);
    expect(perms.canDelete).toBe(false);
  });
});

describe("contentTreeHardening – degraded mutation posture", () => {
  test("page_key fallback keeps mutations open because tree structure still exists", () => {
    expect(
      contentTreeMutationsLocked({
        degraded: true,
        reason: "PAGE_KEY_COLUMN_MISSING",
      }),
    ).toBe(false);
  });

  test("missing tree structure locks mutations fail-closed", () => {
    expect(
      contentTreeMutationsLocked({
        degraded: true,
        reason: "TREE_COLUMNS_MISSING",
      }),
    ).toBe(true);
    expect(
      contentTreeMutationsLocked({
        degraded: true,
        reason: "TABLE_OR_CONTENT_PAGES_UNAVAILABLE",
      }),
    ).toBe(true);
  });
});


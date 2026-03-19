/**
 * Pure helpers for the content tree UI.
 *
 * Tree data source: persisted. ContentTree fetches from GET /api/backoffice/content/tree,
 * which builds from content_pages (tree_parent_id, tree_root_key, tree_sort_order).
 * Move is persisted via POST /api/backoffice/content/tree/move.
 *
 * This file: findNode, flattenVisible are used by ContentTree on API response roots.
 * getMockRoots / getMockRoot are legacy (not used as tree data source).
 * removeNodeFromTree / addChildToTree are legacy helpers; not used for persistence.
 */

import type { ContentTreeNode } from "./treeTypes";

const HOME_ID = "home";

export const MOCK_RECYCLE_BIN_ID = "recycle-bin";

function node(
  id: string,
  parentId: string | null,
  name: string,
  opts: {
    slug?: string;
    hasChildren?: boolean;
    children?: ContentTreeNode[];
    icon?: ContentTreeNode["icon"];
  } = {}
): ContentTreeNode {
  const children = opts.children ?? [];
  return {
    id,
    parentId,
    name,
    slug: opts.slug,
    hasChildren: opts.hasChildren ?? children.length > 0,
    children: children.length ? children : undefined,
    icon: opts.icon,
  };
}

/** Slugs for fixed backoffice pages (must match migration seed_fixed_backoffice_pages). */
const FIXED_PAGE_SLUGS = {
  week: "week",
  dashboard: "dashboard",
  companyAdmin: "company-admin",
  superadmin: "superadmin",
  kitchen: "kitchen",
  driver: "driver",
} as const;

const overlayTreeNodes: ContentTreeNode[] = [
  node("app-overlay-week", "overlays", "Week", { slug: "week", icon: "document" }),
  node("app-overlay-dashboard", "overlays", "Dashboard", { slug: FIXED_PAGE_SLUGS.dashboard, icon: "document" }),
  node("app-overlay-company-admin", "overlays", "Company Admin", { slug: FIXED_PAGE_SLUGS.companyAdmin, icon: "document" }),
  node("app-overlay-superadmin", "overlays", "Superadmin", { slug: FIXED_PAGE_SLUGS.superadmin, icon: "document" }),
  node("app-overlay-kitchen", "overlays", "Kitchen", { slug: FIXED_PAGE_SLUGS.kitchen, icon: "document" }),
  node("app-overlay-driver", "overlays", "Driver", { slug: FIXED_PAGE_SLUGS.driver, icon: "document" }),
];

/** Root nodes: Hjem, App overlays, Global, Design. */
export function getMockRoots(): ContentTreeNode[] {
  return [
    node(HOME_ID, null, "Hjem", {
      slug: "home",
      icon: "home",
      hasChildren: false,
    }),
    node("overlays", null, "App overlays", {
      icon: "folder",
      hasChildren: true,
      children: overlayTreeNodes,
    }),
    node("global", null, "Global", {
      icon: "folder",
      hasChildren: true,
      children: [
        node("global-header", "global", "Header", { slug: "header", icon: "document" }),
        node("global-footer", "global", "Footer", { slug: "footer", icon: "document" }),
      ],
    }),
    node("design", null, "Design", {
      icon: "folder",
      hasChildren: true,
      children: [
        node("design-tokens", "design", "Design tokens", { slug: "design-tokens", icon: "document" }),
      ],
    }),
  ];
}

/** Single root (backward compat). Returns first root when only one; for multi-root use getMockRoots. */
export function getMockRoot(): ContentTreeNode {
  return getMockRoots()[0];
}

export function findNode(roots: ContentTreeNode[], id: string): ContentTreeNode | null {
  for (const root of roots) {
    const found = findInNode(root, id);
    if (found) return found;
  }
  return null;
}

function findInNode(n: ContentTreeNode, id: string): ContentTreeNode | null {
  if (n.id === id) return n;
  for (const child of n.children ?? []) {
    const found = findInNode(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Ensure at most one root per id (first occurrence wins).
 * Prevents duplicate Hjem/Home or other roots from malformed or legacy API responses.
 */
export function dedupeRootsById(roots: ContentTreeNode[]): ContentTreeNode[] {
  const seen = new Set<string>();
  return roots.filter((n) => {
    if (n == null || typeof n !== "object" || seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

/** Flatten forest: all roots, children only when parent is expanded. */
export function flattenVisible(
  roots: ContentTreeNode[],
  expandedIds: Set<string>
): { node: ContentTreeNode; level: number }[] {
  const out: { node: ContentTreeNode; level: number }[] = [];
  function walk(n: ContentTreeNode, level: number) {
    out.push({ node: n, level });
    if (n.hasChildren && n.children?.length && expandedIds.has(n.id)) {
      for (const c of n.children) walk(c, level + 1);
    }
  }
  for (const root of roots) {
    if (root == null) continue;
    walk(root, 0);
  }
  return out;
}

/** Remove node by id from forest. Returns new roots array. */
export function removeNodeFromTree(roots: ContentTreeNode[], id: string): ContentTreeNode[] {
  return roots
    .map((r) => removeFromNode(r, id))
    .filter((c): c is ContentTreeNode => c !== null);
}

function removeFromNode(n: ContentTreeNode, id: string): ContentTreeNode | null {
  if (n.id === id) return null;
  const children = n.children
    ?.map((c) => removeFromNode(c, id))
    .filter((c): c is ContentTreeNode => c !== null);
  return { ...n, children };
}

/** Add child to node with parentId. Returns new roots (same array shape). */
export function addChildToTree(
  roots: ContentTreeNode[],
  parentId: string,
  child: ContentTreeNode
): ContentTreeNode[] {
  return roots.map((r) => addChildInNode(r, parentId, child));
}

function addChildInNode(
  n: ContentTreeNode,
  parentId: string,
  child: ContentTreeNode
): ContentTreeNode {
  if (n.id === parentId) {
    const children = [...(n.children ?? []), child];
    return { ...n, hasChildren: true, children };
  }
  const children = n.children?.map((c) => addChildInNode(c, parentId, child)) ?? [];
  return { ...n, children };
}

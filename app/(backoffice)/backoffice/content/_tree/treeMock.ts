/**
 * Pure helpers for the content tree UI.
 *
 * Tree data source: persisted. ContentTree fetches from GET /api/backoffice/content/tree,
 * which builds from content_pages (tree_parent_id, tree_root_key, tree_sort_order).
 * Move is persisted via POST /api/backoffice/content/tree/move.
 *
 * This file: findNode, flattenVisible, collectDescendantIds, dedupeRootsById are used on API-shaped trees.
 * getMockRoots / getMockRoot — fixtures for unit tests only (not used by live ContentTree).
 * removeNodeFromTree / addChildToTree — legacy helpers for tests; not used by live ContentTree.
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

/** Case-insensitive match on name or slug (CP9 — tree filter). */
export function contentTreeNodeMatchesFilter(node: ContentTreeNode, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  const name = (node.name ?? "").toLowerCase();
  const slug = (typeof node.slug === "string" ? node.slug : "").toLowerCase();
  return name.includes(q) || slug.includes(q);
}

/**
 * Node ids to show when filtering (self-match or path to match). `null` = no filter active.
 */
export function collectVisibleNodeIdsForTreeFilter(roots: ContentTreeNode[], needle: string): Set<string> | null {
  const q = needle.trim();
  if (!q) return null;
  const ids = new Set<string>();
  function walk(nodes: ContentTreeNode[], ancestors: string[]): boolean {
    let any = false;
    for (const node of nodes) {
      const selfMatch = contentTreeNodeMatchesFilter(node, q);
      const childAny = node.children?.length ? walk(node.children, [...ancestors, node.id]) : false;
      if (selfMatch || childAny) {
        ancestors.forEach((id) => ids.add(id));
        ids.add(node.id);
        any = true;
      }
    }
    return any;
  }
  walk(roots, []);
  return ids;
}

/** Expand folders so filter matches become visible. */
export function collectExpandedIdsForTreeFilter(roots: ContentTreeNode[], needle: string): Set<string> {
  const q = needle.trim();
  const expanded = new Set<string>();
  if (!q) return expanded;
  function walk(nodes: ContentTreeNode[], ancestors: string[]): boolean {
    let any = false;
    for (const node of nodes) {
      const selfMatch = contentTreeNodeMatchesFilter(node, q);
      let childAny = false;
      if (node.children?.length) {
        childAny = walk(node.children, [...ancestors, node.id]);
      }
      if (selfMatch || childAny) {
        ancestors.forEach((id) => expanded.add(id));
        if (childAny && node.children?.length) expanded.add(node.id);
        any = true;
      }
    }
    return any;
  }
  walk(roots, []);
  return expanded;
}

/** Path of ancestor node ids that must be expanded so `targetId` is reachable (excludes target). */
export function ancestorIdsToExpand(roots: ContentTreeNode[], targetId: string): string[] {
  const path: string[] = [];
  function walk(nodes: ContentTreeNode[], acc: string[]): boolean {
    for (const n of nodes) {
      if (n.id === targetId) {
        path.push(...acc);
        return true;
      }
      if (n.children?.length && walk(n.children, [...acc, n.id])) return true;
    }
    return false;
  }
  walk(roots, []);
  return path;
}

/**
 * Ids to expand so `selectedId` is visible (ancestors of selected page, or virtual home root chain).
 * Mirrors ContentTree expand logic — single source for post-create reveal tests.
 */
export function expandIdsForSelection(roots: ContentTreeNode[], selectedId: string | null): string[] {
  if (!selectedId) return [];
  const path = ancestorIdsToExpand(roots, selectedId);
  if (path.length) return path;
  for (const r of roots) {
    if (r.nodeType === "root" && r.targetPageId === selectedId) {
      return [r.id];
    }
  }
  return [];
}

/**
 * U97F — After POST create, expand branch so the new node is proofable in the tree.
 * Prefer expansion derived from the new node id when it already appears in `roots`;
 * otherwise expand through known `parentPageId` so the next paint shows the child once the API catches up.
 */
export function expandRevealIdsForPostCreate(
  roots: ContentTreeNode[],
  newPageId: string,
  parentPageId: string | null,
): string[] {
  const fromNew = expandIdsForSelection(roots, newPageId);
  if (fromNew.length > 0) return fromNew;
  if (parentPageId) {
    const anc = ancestorIdsToExpand(roots, parentPageId);
    return [...anc, parentPageId];
  }
  return [];
}

/** All descendant ids including the root id (for move target exclusion). */
export function collectDescendantIds(roots: ContentTreeNode[], id: string): Set<string> {
  const target = findNode(roots, id);
  if (!target) return new Set();
  const out = new Set<string>();
  function walk(n: ContentTreeNode) {
    out.add(n.id);
    for (const c of n.children ?? []) walk(c);
  }
  walk(target);
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

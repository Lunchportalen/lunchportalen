import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";

function denyResponse(s: { response?: Response; res?: Response; ctx?: { rid: string } }): Response {
  if (s?.response instanceof Response) return s.response;
  if (s?.res instanceof Response) return s.res;
  const rid = s?.ctx?.rid ?? "rid_missing";
  return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
}

type PageRow = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  page_key: string | null;
  tree_parent_id: string | null;
  tree_root_key: string | null;
  tree_sort_order: number;
};

export type TreeApiNode = {
  id: string;
  parentId: string | null;
  name: string;
  slug?: string;
  hasChildren: boolean;
  children?: TreeApiNode[];
  status?: "draft" | "published";
  icon?: "home" | "folder" | "document";
  /**
   * Stable semantic kind for node binding (home, employee_week, superadmin, company_admin, kitchen, driver, overlay, global, design, page).
   * Used by backoffice to bind to workspaces and preview targets without relying on mutable slugs.
   */
  kind?: string;
  /**
   * Authoritative node type for UI semantics.
   * - "folder": folder-only (expand/collapse, no workspace)
   * - "page": regular content page
   * - "root": special virtual root (e.g. home) that may have a targetPageId
   */
  nodeType?: "folder" | "page" | "root";
  /**
   * Optional target page id for virtual roots (e.g. Hjem → Forside page id).
   */
  targetPageId?: string | null;
};

const VIRTUAL_ROOTS: TreeApiNode[] = [
  { id: "home", parentId: null, name: "Hjem", slug: "home", hasChildren: true, icon: "home", kind: "home", nodeType: "root", targetPageId: null },
  { id: "overlays", parentId: null, name: "App overlays", hasChildren: true, icon: "folder", kind: "app_overlay_folder", nodeType: "folder" },
  { id: "global", parentId: null, name: "Global", hasChildren: true, icon: "folder", kind: "global", nodeType: "folder" },
  { id: "design", parentId: null, name: "Design", hasChildren: true, icon: "folder", kind: "design", nodeType: "folder" },
];

/** Serialize thrown value for logging/detail; never "[object Object]". */
function serializeError(e: unknown): string {
  if (e == null) return "Unknown error";
  if (e instanceof Error) return e.message || e.name || "Error";
  if (typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    return (e as { message: string }).message;
  }
  try {
    const s = JSON.stringify(e);
    return s.length > 500 ? s.slice(0, 500) + "…" : s;
  } catch {
    return String(e);
  }
}

/** True if Supabase/Postgres error indicates missing table (e.g. migration not applied). */
function isMissingTableError(e: unknown): boolean {
  const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : "";
  const msg = serializeError(e).toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || (msg.includes("relation") && msg.includes("content_pages"));
}

function normalizePages(pages: PageRow[]): PageRow[] {
  const byId = new Map<string, PageRow>();
  const bySlugPath = new Map<string, PageRow>();

  for (const p of pages) {
    const existing = byId.get(p.id);
    if (!existing) {
      byId.set(p.id, p);
      continue;
    }

    const existingIsPublished = existing.status === "published";
    const currentIsPublished = p.status === "published";

    const keepCurrent =
      (!existingIsPublished && currentIsPublished) ||
      (existingIsPublished === currentIsPublished &&
        (p.tree_sort_order < existing.tree_sort_order ||
          (p.tree_sort_order === existing.tree_sort_order && p.id < existing.id)));

    if (keepCurrent) {
      byId.set(p.id, p);
    }
  }

  for (const p of byId.values()) {
    const slug = (p.slug ?? "").trim();
    if (!slug) continue;
    const parentKey = p.tree_parent_id ?? `root:${p.tree_root_key ?? ""}`;
    const key = `${parentKey}::${slug}`;
    const existing = bySlugPath.get(key);
    if (!existing) {
      bySlugPath.set(key, p);
      continue;
    }

    const existingIsPublished = existing.status === "published";
    const currentIsPublished = p.status === "published";

    const keepCurrent =
      (!existingIsPublished && currentIsPublished) ||
      (existingIsPublished === currentIsPublished &&
        (p.tree_sort_order < existing.tree_sort_order ||
          (p.tree_sort_order === existing.tree_sort_order && p.id < existing.id)));

    if (keepCurrent) {
      bySlugPath.set(key, p);
    }
  }

  const source = bySlugPath.size > 0 ? bySlugPath : byId;
  return Array.from(source.values());
}

function pageToNode(p: PageRow): TreeApiNode {
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

function buildTree(
  pages: PageRow[],
  virtualRoots: TreeApiNode[]
): TreeApiNode[] {
  const byParent = new Map<string, PageRow[]>();
  const byRoot = new Map<string, PageRow[]>();

  // Fixed app surfaces that must always appear as children under virtual Hjem (home),
  // regardless of where they live in tree_root_key / tree_parent_id.
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

  // Collect fixed app pages by stable page_key; these will be attached under Hjem
  // as leaf nodes irrespective of their root placement.
  const fixedAppPages: PageRow[] = pages
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

  for (const virtual of virtualRoots) {
    rootsById.set(virtual.id, { ...virtual, children: [], hasChildren: false });
  }

  // Resolve real Forside page id from stable page_key to bind Hjem target deterministically.
  const homeRoot = rootsById.get("home")!;
  const forside = pages.find((p) => (p.page_key ?? "").trim().toLowerCase() === "home");
  if (forside) {
    homeRoot.targetPageId = forside.id;
  }

  // Primary placement from tree_root_key / tree_parent_id
  for (const root of virtualRoots) {
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

    // Place fixed app surfaces as children under Hjem even if they live under overlays in DB.
    if (root.id === "overlays") {
      const overlayChildren: TreeApiNode[] = [];

      for (const p of underRoot) {
        // Skip fixed app pages here; they are attached under Hjem via fixedAppPages.
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

    const rootNode = rootsById.get(root.id)!;

    if (root.id === "home") {
      // Hjem is a virtual root: attach all fixed app surfaces as children (leaf nodes),
      // never the real Forside page (page_key = "home").
      const homeChildren: TreeApiNode[] = fixedAppPages.map((p) => {
        const n = pageToNode(p);
        n.parentId = homeRootNode.id;
        // Fixed app pages are treated as leaf nodes in the backoffice tree.
        n.hasChildren = false;
        delete n.children;
        return n;
      });

      homeRootNode.children = homeChildren;
      homeRootNode.hasChildren = homeChildren.length > 0;

      continue;
    }

    const children: TreeApiNode[] = underRoot
      // Never attach fixed app pages under non-home roots; they belong under Hjem only.
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

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);
  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  try {
    const supabase = supabaseAdmin();
    const { data: rows, error } = await supabase
      .from("content_pages")
      .select("id, title, slug, status, page_key, tree_parent_id, tree_root_key, tree_sort_order")
      .order("tree_sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    const pages = normalizePages((rows ?? []) as PageRow[]);

    const roots = buildTree(pages, VIRTUAL_ROOTS);

    return jsonOk(ctx.rid, { roots }, 200);
  } catch (e) {
    const detailMsg = serializeError(e);
    const code = typeof (e as { code?: string })?.code === "string" ? (e as { code: string }).code : null;

    if (isMissingTableError(e)) {
      try {
        const { opsLog } = await import("@/lib/ops/log");
        opsLog("incident", {
          rid: ctx.rid,
          route: "/api/backoffice/content/tree",
          message: "content_pages table missing or inaccessible; returning empty tree",
          error: detailMsg,
          code: code ?? undefined,
        });
      } catch {
        // ignore
      }
      const emptyRoots = buildTree([], VIRTUAL_ROOTS);
      return jsonOk(ctx.rid, { roots: emptyRoots }, 200);
    }

    const msg = detailMsg || "Internal server error";
    return jsonErr(ctx.rid, msg, 500, "SERVER_ERROR", { detail: detailMsg, code });
  }
}

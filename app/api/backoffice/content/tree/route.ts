import type { NextRequest } from "next/server";
import {
  cloneContentTreeVirtualRoots,
  isContentTreeFixedPageKind,
} from "@/lib/cms/contentTreeRoots";
import {
  applyInferredPageKeys,
} from "@/lib/cms/contentTreePageKey";
import { resolveTreeRouteSchemaIssue } from "@/lib/cms/treeRouteSchema";
import {
  getLocalDevContentReservePages,
  isContentBackendUnavailableError,
  isLocalDevContentReserveEnabled,
} from "@/lib/cms/contentLocalDevReserve";
import { contentTreeMutationsLocked } from "@/lib/cms/contentTreeRuntime";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";
import { isLocalCmsRuntimeError, listLocalCmsTreePages } from "@/lib/localRuntime/cmsProvider";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { supabaseAdmin } from "@/lib/supabase/admin";

function denyResponse(s: {
  response?: Response;
  res?: Response;
  ctx?: { rid: string };
}): Response {
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
  /** Persisted sibling order (content_pages.tree_sort_order). Used by editor for reorder/move. */
  treeSortOrder?: number;
};

type TreeFetchResult =
  | {
      ok: true;
      degraded: boolean;
      pages: PageRow[];
      reason?: string;
      operatorMessage?: string;
      operatorAction?: string;
      schemaHints?: Record<string, unknown>;
    }
  | {
      ok: false;
      error: unknown;
    };

/** Serialize thrown value for logging/detail; never "[object Object]". */
function serializeError(e: unknown): string {
  if (e == null) return "Unknown error";
  if (e instanceof Error) return e.message || e.name || "Error";
  if (
    typeof e === "object" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return (e as { message: string }).message;
  }
  try {
    const s = JSON.stringify(e);
    return s.length > 500 ? `${s.slice(0, 500)}…` : s;
  } catch {
    return String(e);
  }
}

function getErrorCode(e: unknown): string | null {
  return typeof (e as { code?: string })?.code === "string"
    ? (e as { code: string }).code
    : null;
}

async function logIncident(payload: {
  rid: string;
  route: string;
  message: string;
  error?: string;
  code?: string | null;
}) {
  try {
    const { opsLog } = await import("@/lib/ops/log");
    opsLog("incident", {
      rid: payload.rid,
      route: payload.route,
      message: payload.message,
      error: payload.error,
      code: payload.code ?? undefined,
    });
  } catch {
    // ignore logging failures
  }
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
    status: p.status === "published" ? "published" : "draft",
    icon: "document",
    nodeType: "page",
    kind: p.page_key ?? "page",
    treeSortOrder:
      typeof p.tree_sort_order === "number" ? p.tree_sort_order : 0,
  };
}

function buildTree(pages: PageRow[], virtualRoots: TreeApiNode[]): TreeApiNode[] {
  const byParent = new Map<string, PageRow[]>();
  const byRoot = new Map<string, PageRow[]>();

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

  for (const list of [...Array.from(byParent.values()), ...Array.from(byRoot.values())]) {
    list.sort(
      (a, b) =>
        a.tree_sort_order - b.tree_sort_order ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  }

  const fixedAppPages: PageRow[] = pages
    .filter((p) => isContentTreeFixedPageKind(p.page_key))
    .sort(
      (a, b) =>
        a.tree_sort_order - b.tree_sort_order ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );

  const fixedAppIds = new Set(fixedAppPages.map((p) => p.id));

  function addChildren(node: TreeApiNode, parentId: string): void {
    const underParent = byParent.get(parentId) ?? [];
    const children: TreeApiNode[] = underParent.map((p) => {
      const n = pageToNode(p);
      n.hasChildren = (byParent.get(p.id)?.length ?? 0) > 0;
      if (n.hasChildren) n.children = [];
      return n;
    });

    for (const child of children) addChildren(child, child.id);

    node.children = children;
    node.hasChildren = children.length > 0;
  }

  const rootsById = new Map<string, TreeApiNode>();
  for (const virtual of virtualRoots) {
    rootsById.set(virtual.id, {
      ...virtual,
      children: [],
      hasChildren: false,
    });
  }

  const homeRoot = rootsById.get("home");
  if (homeRoot) {
    const forside = pages.find(
      (p) => (p.page_key ?? "").trim().toLowerCase() === "home",
    );
    if (forside) {
      homeRoot.targetPageId = forside.id;
    }
  }

  for (const root of virtualRoots) {
    const rootNode = rootsById.get(root.id);
    if (!rootNode) continue;

    const rootKey =
      root.id === "home"
        ? "home"
        : root.id === "overlays"
          ? "overlays"
          : root.id === "global"
            ? "global"
            : "design";

    const underRoot = byRoot.get(rootKey) ?? [];

    if (root.id === "overlays") {
      const overlayChildren = underRoot
        .filter((p) => !fixedAppIds.has(p.id))
        .map((p) => {
          const n = pageToNode(p);
          n.parentId = rootNode.id;
          return n;
        });

      rootNode.children = overlayChildren;
      rootNode.hasChildren = overlayChildren.length > 0;

      for (const child of overlayChildren) {
        addChildren(child, child.id);
      }

      continue;
    }

    if (root.id === "home") {
      const homeChildren: TreeApiNode[] = fixedAppPages.map((p) => {
        const n = pageToNode(p);
        n.parentId = rootNode.id;
        n.hasChildren = false;
        delete n.children;
        return n;
      });

      rootNode.children = homeChildren;
      rootNode.hasChildren = homeChildren.length > 0;
      continue;
    }

    const children = underRoot
      .filter((p) => !fixedAppIds.has(p.id))
      .map((p) => {
        const n = pageToNode(p);
        n.parentId = rootNode.id;
        n.hasChildren = (byParent.get(p.id)?.length ?? 0) > 0;
        if (n.hasChildren) n.children = [];
        return n;
      });

    for (const child of children) addChildren(child, child.id);

    rootNode.children = children;
    rootNode.hasChildren = children.length > 0;
  }

  return Array.from(rootsById.values());
}

async function fetchPagesWithSchemaFallback(rid: string): Promise<TreeFetchResult> {
  if (isLocalCmsRuntimeEnabled()) {
    return {
      ok: true,
      degraded: false,
      pages: normalizePages(
        listLocalCmsTreePages().map((page) => ({
          id: page.id,
          title: page.title,
          slug: page.slug,
          status: page.status,
          page_key: page.page_key,
          tree_parent_id: page.tree_parent_id,
          tree_root_key: page.tree_root_key,
          tree_sort_order: page.tree_sort_order,
        })),
      ),
    };
  }

  if (isLocalDevContentReserveEnabled()) {
    await logIncident({
      rid,
      route: "/api/backoffice/content/tree",
      message: "local dev content reserve enabled; returning reserve tree pages",
    });

    return {
      ok: true,
      degraded: true,
      reason: "LOCAL_DEV_CONTENT_RESERVE",
      operatorMessage:
        "Lokal reserve er aktivert eksplisitt. Tree og editor bruker lokale reservesider til den ekte content-backenden er tilbake.",
      operatorAction:
        "Deaktiver LOCAL_DEV_CONTENT_RESERVE nar Supabase svarer igjen, sa tree og editor gar mot systemdata.",
      pages: normalizePages(
        getLocalDevContentReservePages().map((page) => ({
          id: page.id,
          title: page.title,
          slug: page.slug,
          status: page.status,
          page_key: page.page_key,
          tree_parent_id: page.tree_parent_id,
          tree_root_key: page.tree_root_key,
          tree_sort_order: page.tree_sort_order,
        })),
      ),
      schemaHints: {
        detail:
          "LOCAL_DEV_CONTENT_RESERVE is active. Tree responses come from deterministic reserve data in local development.",
      },
    };
  }

  const supabase = supabaseAdmin();

  const selectFull =
    "id, title, slug, status, page_key, tree_parent_id, tree_root_key, tree_sort_order";
  const selectWithoutPageKey =
    "id, title, slug, status, tree_parent_id, tree_root_key, tree_sort_order";

  const first = await supabase
    .from("content_pages")
    .select(selectFull)
    .order("tree_sort_order", { ascending: true })
    .order("id", { ascending: true });

  if (!first.error) {
    const raw = (first.data ?? []) as Record<string, unknown>[];
    const rows: PageRow[] = raw.map((r) => ({
      id: String(r.id ?? ""),
      title: (r.title as string | null) ?? null,
      slug: (r.slug as string | null) ?? null,
      status: (r.status as string | null) ?? null,
      page_key: (r.page_key as string | null) ?? null,
      tree_parent_id: (r.tree_parent_id as string | null) ?? null,
      tree_root_key: (r.tree_root_key as string | null) ?? null,
      tree_sort_order: typeof r.tree_sort_order === "number" ? r.tree_sort_order : 0,
    }));

    return {
      ok: true,
      degraded: false,
      pages: normalizePages(applyInferredPageKeys(rows)),
    };
  }

  if (isContentBackendUnavailableError(first.error)) {
    await logIncident({
      rid,
      route: "/api/backoffice/content/tree",
      message: "content_pages query failed because backend is unreachable; returning virtual roots only",
      error: serializeError(first.error),
      code: getErrorCode(first.error),
    });

    return {
      ok: true,
      degraded: true,
      reason: "BACKEND_UNREACHABLE",
      operatorMessage:
        "Content-backenden svarte ikke. Treet holder seg oppe med trygge rotnoder mens Supabase er utilgjengelig.",
      operatorAction:
        "Kontroller DNS eller nettverk mot Supabase. Aktiver LOCAL_DEV_CONTENT_RESERVE=true eksplisitt hvis du trenger lokal editorverifisering uten backend.",
      pages: [],
      schemaHints: {
        detail: serializeError(first.error),
        code: getErrorCode(first.error),
      },
    };
  }

  const schemaIssue = resolveTreeRouteSchemaIssue(first.error);

  if (schemaIssue?.reason === "TABLE_OR_CONTENT_PAGES_UNAVAILABLE") {
    await logIncident({
      rid,
      route: "/api/backoffice/content/tree",
      message: "content_pages table missing or inaccessible; returning virtual roots only",
      error: serializeError(first.error),
      code: getErrorCode(first.error),
    });

    return {
      ok: true,
      degraded: true,
      reason: schemaIssue.reason,
      operatorMessage: schemaIssue.operatorMessage,
      operatorAction: schemaIssue.operatorAction,
      pages: [],
      schemaHints: schemaIssue.schemaHints,
    };
  }

  if (schemaIssue?.reason === "PAGE_KEY_COLUMN_MISSING") {
    await logIncident({
      rid,
      route: "/api/backoffice/content/tree",
      message: "content_pages.page_key column missing; legacy select + inferred page keys",
      error: serializeError(first.error),
      code: getErrorCode(first.error),
    });

    const second = await supabase
      .from("content_pages")
      .select(selectWithoutPageKey)
      .order("tree_sort_order", { ascending: true })
      .order("id", { ascending: true });

    if (second.error) {
      return { ok: false, error: second.error };
    }

    const raw = (second.data ?? []) as Record<string, unknown>[];
    const rows: PageRow[] = raw.map((r) => ({
      id: String(r.id ?? ""),
      title: (r.title as string | null) ?? null,
      slug: (r.slug as string | null) ?? null,
      status: (r.status as string | null) ?? null,
      page_key: null,
      tree_parent_id: (r.tree_parent_id as string | null) ?? null,
      tree_root_key: (r.tree_root_key as string | null) ?? null,
      tree_sort_order: typeof r.tree_sort_order === "number" ? r.tree_sort_order : 0,
    }));

    return {
      ok: true,
      degraded: true,
      reason: schemaIssue.reason,
      operatorMessage: schemaIssue.operatorMessage,
      operatorAction: schemaIssue.operatorAction,
      pages: normalizePages(applyInferredPageKeys(rows)),
      schemaHints: schemaIssue.schemaHints,
    };
  }

  if (schemaIssue?.reason === "TREE_COLUMNS_MISSING") {
    await logIncident({
      rid,
      route: "/api/backoffice/content/tree",
      message: "content_pages tree columns missing; returning virtual roots only",
      error: serializeError(first.error),
      code: getErrorCode(first.error),
    });

    return {
      ok: true,
      degraded: true,
      reason: schemaIssue.reason,
      operatorMessage: schemaIssue.operatorMessage,
      operatorAction: schemaIssue.operatorAction,
      pages: [],
      schemaHints: schemaIssue.schemaHints,
    };
  }

  if (schemaIssue?.reason === "SCHEMA_OR_CACHE_UNAVAILABLE") {
    await logIncident({
      rid,
      route: "/api/backoffice/content/tree",
      message: "content_pages query failed (schema/cache); returning virtual roots only",
      error: serializeError(first.error),
      code: getErrorCode(first.error),
    });

    return {
      ok: true,
      degraded: true,
      reason: schemaIssue.reason,
      operatorMessage: schemaIssue.operatorMessage,
      operatorAction: schemaIssue.operatorAction,
      pages: [],
      schemaHints: schemaIssue.schemaHints,
    };
  }

  return { ok: false, error: first.error };
}

export async function GET(request: NextRequest) {
  const s = await scopeOr401(request);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const roleDeny = requireRoleOr403(ctx, ["superadmin"]);
  if (roleDeny) return roleDeny;

  try {
    const fetched = await fetchPagesWithSchemaFallback(ctx.rid);
    if (fetched.ok === false) {
      throw fetched.error;
    }

    const roots = buildTree(
      fetched.pages,
      cloneContentTreeVirtualRoots(),
    );
    const mutationsLocked = contentTreeMutationsLocked({
      degraded: fetched.degraded,
      reason: fetched.reason ?? null,
    });

    return jsonOk(
      ctx.rid,
      {
        roots,
        degraded: fetched.degraded,
        mutationsLocked,
        ...(fetched.reason ? { reason: fetched.reason } : {}),
        ...(fetched.operatorMessage ? { operatorMessage: fetched.operatorMessage } : {}),
        ...(fetched.operatorAction ? { operatorAction: fetched.operatorAction } : {}),
        ...(fetched.schemaHints ? { schemaHints: fetched.schemaHints } : {}),
      },
      200,
    );
  } catch (e) {
    if (isLocalCmsRuntimeError(e)) {
      return jsonErr(ctx.rid, e.message, e.status, e.code, e.detail);
    }
    const detailMsg = serializeError(e);
    const code = getErrorCode(e);

    await logIncident({
      rid: ctx.rid,
      route: "/api/backoffice/content/tree",
      message: "content tree route failed unexpectedly",
      error: detailMsg,
      code,
    });

    return jsonErr(ctx.rid, detailMsg || "Internal server error", 500, "SERVER_ERROR", {
      detail: detailMsg,
      code,
    });
  }
}
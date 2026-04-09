import type { ContentTreeNode } from "./treeTypes";
import { contentTreeMutationsLocked } from "@/lib/cms/contentTreeRuntime";

/** JSON shape from GET /api/backoffice/content/tree (data.roots). */
export type TreeApiNodeJson = {
  id: string;
  parentId: string | null;
  name: string;
  slug?: string;
  hasChildren: boolean;
  children?: TreeApiNodeJson[];
  status?: "draft" | "published";
  icon?: "home" | "folder" | "document";
  kind?: string;
  nodeType?: "folder" | "page" | "root";
  targetPageId?: string | null;
  treeSortOrder?: number;
};

export function mapTreeApiRootsToContentNodes(roots: unknown): ContentTreeNode[] {
  if (!Array.isArray(roots)) return [];
  return roots.map(mapOne);
}

function mapOne(n: unknown): ContentTreeNode {
  if (!n || typeof n !== "object") {
    throw new Error("Invalid tree node");
  }
  const o = n as TreeApiNodeJson;
  return {
    id: String(o.id),
    parentId: o.parentId == null ? null : String(o.parentId),
    name: String(o.name ?? ""),
    slug: o.slug,
    hasChildren: Boolean(o.hasChildren),
    children: Array.isArray(o.children) ? o.children.map(mapOne) : undefined,
    status: o.status,
    icon: o.icon,
    kind: o.kind,
    nodeType: o.nodeType,
    targetPageId: o.targetPageId ?? undefined,
    treeSortOrder: typeof o.treeSortOrder === "number" ? o.treeSortOrder : undefined,
  };
}

/** Parse jsonOk body from fetch: `{ ok, rid, data: { roots } }`. */
export function parseTreeRootsFromJsonResponse(json: unknown): ContentTreeNode[] {
  if (!json || typeof json !== "object") return [];
  const top = json as Record<string, unknown>;
  if (top.ok === false) return [];
  const data = top.data;
  if (!data || typeof data !== "object") return [];
  const roots = (data as { roots?: unknown }).roots;
  return mapTreeApiRootsToContentNodes(roots);
}

export type TreeFetchEnvelope = {
  roots: ContentTreeNode[];
  degraded: boolean;
  mutationsLocked: boolean;
  /** Kort brukermelding (schema fallback, degradert tre, …). */
  schemaHint: string | null;
  degradedReason: string | null;
  operatorMessage?: string | null;
  operatorAction?: string | null;
  technicalDetail?: string | null;
  missingColumns?: string[];
  technicalCode?: string | null;
};

/** U30X — Leser `degraded`, `reason`, `schemaHints` fra tree-API for ærlig UI. */
export function parseTreeFetchEnvelope(json: unknown): TreeFetchEnvelope {
  const empty: TreeFetchEnvelope = {
    roots: [],
    degraded: false,
    mutationsLocked: false,
    schemaHint: null,
    degradedReason: null,
    operatorMessage: null,
    operatorAction: null,
    technicalDetail: null,
    missingColumns: [],
    technicalCode: null,
  };
  if (!json || typeof json !== "object") return empty;
  const top = json as Record<string, unknown>;
  if (top.ok === false) return empty;
  const data = top.data;
  if (!data || typeof data !== "object") return empty;
  const d = data as {
    roots?: unknown;
    degraded?: boolean;
    mutationsLocked?: boolean;
    reason?: string;
    schemaHints?: {
      pageKeyColumnMissing?: boolean;
      pageKeyInferredFromSlug?: boolean;
      treeColumnsMissing?: boolean;
      tableMissing?: boolean;
      queryFailed?: boolean;
      missingColumns?: string[];
      detail?: string;
      code?: string | null;
    };
    operatorMessage?: string;
    operatorAction?: string;
  };
  const roots = mapTreeApiRootsToContentNodes(d.roots);
  const degraded = Boolean(d.degraded);
  const degradedReason = typeof d.reason === "string" ? d.reason : null;
  const mutationsLocked =
    typeof d.mutationsLocked === "boolean"
      ? d.mutationsLocked
      : contentTreeMutationsLocked({ degraded, reason: degradedReason });
  const hints = d.schemaHints;
  const operatorMessage =
    typeof d.operatorMessage === "string" ? d.operatorMessage : null;
  const operatorAction =
    typeof d.operatorAction === "string" && d.operatorAction.trim()
      ? d.operatorAction.trim()
      : null;
  const technicalDetail =
    hints && typeof hints.detail === "string" && hints.detail.trim()
      ? hints.detail.trim()
      : null;
  const technicalCode =
    hints && typeof hints.code === "string" && hints.code.trim()
      ? hints.code.trim()
      : null;
  const missingColumns =
    hints && Array.isArray(hints.missingColumns)
      ? hints.missingColumns
          .map((value) => String(value ?? "").trim())
          .filter(Boolean)
      : [];

  let schemaHint: string | null = null;
  if (hints?.pageKeyColumnMissing) {
    schemaHint = missingColumns.length > 0
      ? `Manglende kolonne: ${missingColumns.join(", ")}. Kind er utledet fra slug midlertidig.`
      : "page_key-kolonne mangler i DB — kind er utledet fra slug (midlertidig).";
  } else if (hints?.treeColumnsMissing) {
    schemaHint = missingColumns.length > 0
      ? `Tree-kolonner mangler i content_pages: ${missingColumns.join(", ")}. Viser en trygg reservevisning til migrasjonene er på plass.`
      : "Tree-kolonner mangler i content_pages — viser en trygg reservevisning til migrasjonene er på plass.";
  } else if (hints?.queryFailed) {
    schemaHint = "Tre-API kunne ikke lese alle kolonner — viser virtuelle mapper uten sider. Sjekk migrasjoner.";
  } else if (hints?.tableMissing) {
    schemaHint = "content_pages er ikke tilgjengelig i dette miljøet — viser virtuelle mapper uten sider.";
  }

  if (degraded && !schemaHint) {
    if (degradedReason === "TABLE_OR_CONTENT_PAGES_UNAVAILABLE") {
      schemaHint = "content_pages er ikke tilgjengelig i dette miljøet — viser virtuelle mapper uten sider.";
    } else if (degradedReason === "TREE_COLUMNS_MISSING") {
      schemaHint =
        "Tree-kolonner mangler i content_pages — viser en trygg reservevisning til migrasjonene er på plass.";
    } else if (degradedReason === "PAGE_KEY_COLUMN_MISSING") {
      schemaHint = "page_key-kolonne mangler i DB — kind er utledet fra slug (midlertidig).";
    } else if (degradedReason === "SCHEMA_OR_CACHE_UNAVAILABLE") {
      schemaHint = "Schema/cache hindret lesing av tre — viser virtuelle mapper. Sjekk migrasjoner eller Supabase-schema.";
    } else if (degradedReason === "BACKEND_UNREACHABLE") {
      schemaHint =
        "Content-backenden svarte ikke — tree holder seg oppe med trygge rotnoder mens Supabase er utilgjengelig.";
    } else if (degradedReason === "LOCAL_DEV_CONTENT_RESERVE") {
      schemaHint =
        "Lokal content-reserve er aktivert eksplisitt — tree og editor bruker lokale reservesider i stedet for ekstern backend.";
    }
  }

  return {
    roots,
    degraded,
    mutationsLocked,
    schemaHint,
    degradedReason,
    operatorMessage,
    operatorAction,
    technicalDetail,
    missingColumns,
    technicalCode,
  };
}

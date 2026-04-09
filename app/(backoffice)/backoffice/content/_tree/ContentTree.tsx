"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { parseBodyEnvelope } from "@/lib/cms/bodyEnvelopeContract";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
import {
  CONTENT_TREE_HOME_ROOT_ID,
  type ContentTreeRootKey,
  isContentTreeRootKey,
  isContentTreeFixedPageKind,
  isContentTreeFolderRootId,
} from "@/lib/cms/contentTreeRoots";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import {
  buildCreatePayloadForDocumentType,
  resolveAllowedChildAliasesForParent,
  resolveCreateDialogOptions,
  resolveRootCreateAliases,
  type CreateDialogOption,
} from "@/lib/cms/contentCreateFlow";
import { fetchContentTreeEnvelope } from "./fetchContentTree";
import type { TreeFetchEnvelope } from "./mapTreeApiRoots";
import {
  collectExpandedIdsForTreeFilter,
  collectVisibleNodeIdsForTreeFilter,
  dedupeRootsById,
  expandIdsForSelection,
  expandRevealIdsForPostCreate,
  flattenVisible,
  findNode,
  MOCK_RECYCLE_BIN_ID,
} from "./treeMock";
import type { ContentTreeNode, TreePermissions } from "./treeTypes";
import { TreeNodeRow } from "./TreeNodeRow";
import { getPreviewPathForOverlaySlug } from "@/lib/cms/overlays/registry";
import ContentTreeMoveDialog from "./ContentTreeMoveDialog";
import { isContentPageUuid } from "./treeIds";

const BASE = "/backoffice/content";

function formatTreeDegradedReason(reason: string | null): string | null {
  switch (reason) {
    case "PAGE_KEY_COLUMN_MISSING":
      return "page_key mangler";
    case "TREE_COLUMNS_MISSING":
      return "tree-kolonner mangler";
    case "TABLE_OR_CONTENT_PAGES_UNAVAILABLE":
      return "content_pages utilgjengelig";
    case "SCHEMA_OR_CACHE_UNAVAILABLE":
      return "schema/cache utilgjengelig";
    case "BACKEND_UNREACHABLE":
      return "backend utilgjengelig";
    case "LOCAL_DEV_CONTENT_RESERVE":
      return "lokal reserve";
    default:
      return null;
  }
}

function isFixedTreePage(node: ContentTreeNode): boolean {
  return isContentTreeFixedPageKind(node.kind);
}

function isRowSelected(node: ContentTreeNode, selectedId: string | null): boolean {
  if (!selectedId) return false;
  if (selectedId === node.id) return true;
  if (node.nodeType === "root" && node.targetPageId != null && selectedId === node.targetPageId) return true;
  return false;
}

/** Home root node policy (Umbraco 13 parity). Delete/Move are hard-locked for Home. */
function getNodePolicy(nodeId: string) {
  const isHome = nodeId === "home" || nodeId === "root" || nodeId === "home-root";
  return {
    isHome,
    canCreate: true,
    canRename: true,
    canCopyLink: true,
    canPreview: true,
    canMove: !isHome,
    canDelete: !isHome,
  };
}

function permissionsForNode(
  node: ContentTreeNode,
  mutationsLocked: boolean,
): TreePermissions {
  if (mutationsLocked) {
    return {
      canCreate: false,
      canRename: false,
      canMove: false,
      canDelete: false,
    };
  }
  const policy = getNodePolicy(node.id);
  const fixed = isFixedTreePage(node);
  const isVirtualHome = node.id === "home";
  const isVirtualFolder = isContentTreeFolderRootId(node.id);
  const isPageUuid = isContentPageUuid(node.id);

  return {
    canCreate: policy.canCreate && !fixed && !isVirtualHome && (isVirtualFolder || isPageUuid),
    canRename: policy.canRename && !fixed && isPageUuid,
    canMove: policy.canMove && !fixed && isPageUuid,
    canDelete: false,
  };
}

const HOME_NODE_ID = CONTENT_TREE_HOME_ROOT_ID;

type CreateDialogState = {
  open: boolean;
  parentId: string | null;
  parentLabel: string;
  parentDocumentTypeAlias: string | null;
  rootKey: ContentTreeRootKey | null;
  options: CreateDialogOption[];
  selectedAlias: string | null;
  title: string;
  slug: string;
  creating: boolean;
  error: string | null;
};

function normalizeCreateSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ContentTree({
  selectedNodeId,
  onSelectNode,
}: {
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const routeState = useMemo(() => resolveBackofficeContentRoute(pathname), [pathname]);
  const [roots, setRoots] = useState<ContentTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [actionsOpenNodeId, setActionsOpenNodeId] = useState<string | null>(null);
  const [renameState, setRenameState] = useState<{ id: string; draft: string } | null>(null);
  const [homeNavError, setHomeNavError] = useState<string | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ pageId: string; name: string } | null>(null);
  /** API kan levere schemaHints når page_key-kolonne mangler (U30R). */
  const [schemaHint, setSchemaHint] = useState<string | null>(null);
  const [operatorMessage, setOperatorMessage] = useState<string | null>(null);
  const [operatorAction, setOperatorAction] = useState<string | null>(null);
  const [degradedReason, setDegradedReason] = useState<string | null>(null);
  const [treeDegraded, setTreeDegraded] = useState(false);
  const [mutationsLocked, setMutationsLocked] = useState(false);
  const [technicalDetail, setTechnicalDetail] = useState<string | null>(null);
  const [missingColumns, setMissingColumns] = useState<string[]>([]);
  const [technicalCode, setTechnicalCode] = useState<string | null>(null);
  /** CP9 — Umbraco-lignende hurtigsøk i tre (klient-side, ingen ny motor). */
  const [treeFilter, setTreeFilter] = useState("");
  const [mergedDocumentTypes, setMergedDocumentTypes] = useState<Record<string, DocumentTypeDefinition>>({});
  const [createDialog, setCreateDialog] = useState<CreateDialogState>({
    open: false,
    parentId: null,
    parentLabel: "",
    parentDocumentTypeAlias: null,
    rootKey: null,
    options: [],
    selectedAlias: null,
    title: "",
    slug: "",
    creating: false,
    error: null,
  });
  const homeNavInFlightRef = useRef(false);
  const navInFlightRef = useRef(false);

  const applyTreeEnvelope = useCallback((env: TreeFetchEnvelope) => {
    setRoots(dedupeRootsById(env.roots));
    setSchemaHint(env.schemaHint);
    setOperatorMessage(env.operatorMessage ?? null);
    setOperatorAction(env.operatorAction ?? null);
    setDegradedReason(env.degradedReason);
    setTreeDegraded(env.degraded);
    setMutationsLocked(env.mutationsLocked);
    setTechnicalDetail(env.technicalDetail ?? null);
    setMissingColumns(env.missingColumns ?? []);
    setTechnicalCode(env.technicalCode ?? null);
  }, []);

  const clearTreeFailureState = useCallback(() => {
    setRoots([]);
    setSchemaHint(null);
    setOperatorMessage(null);
    setOperatorAction(null);
    setDegradedReason(null);
    setTreeDegraded(false);
    setMutationsLocked(false);
    setTechnicalDetail(null);
    setMissingColumns([]);
    setTechnicalCode(null);
  }, []);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await fetchContentTreeEnvelope();
      if (result.ok === false) {
        clearTreeFailureState();
        setLoadError(
          result.message ??
            (result.kind === "auth"
              ? "Du er ikke innlogget. Oppdater siden eller logg inn på nytt."
              : result.kind === "forbidden"
                ? "Innholdstreet krever superadmin-tilgang. API-et er begrenset til superadmin — kontakt plattformadministrator hvis du trenger tilgang."
                : "Kunne ikke laste tre."),
        );
        return;
      }
      applyTreeEnvelope(result.envelope);
    } catch {
      clearTreeFailureState();
      setLoadError("Nettverksfeil ved lasting av tre.");
    } finally {
      setLoading(false);
    }
  }, [applyTreeEnvelope, clearTreeFailureState]);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/backoffice/cms/document-type-definitions", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; data?: { mergedCore?: Record<string, DocumentTypeDefinition> } }
          | null;
        if (!res.ok || json?.ok === false || !json?.data?.mergedCore) return;
        if (!cancelled) setMergedDocumentTypes(json.data.mergedCore);
      } catch {
        // Fail closed: keep create dialog closed if schema cannot be loaded.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pathnameSelectedId =
    routeState.kind === "recycle-bin" ? MOCK_RECYCLE_BIN_ID : routeState.selectedNodeId;
  const selectedId = selectedNodeId ?? pathnameSelectedId;

  useEffect(() => {
    if (!roots.length) return;
    const sid = selectedId;
    if (!sid) return;
    const extra = expandIdsForSelection(roots, sid);
    if (extra.length) {
      setExpandedIds((prev) => new Set([...prev, ...extra]));
    }
  }, [roots, selectedId]);

  useEffect(() => {
    if (!selectedId || !isContentPageUuid(selectedId)) return;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-lp-content-tree-node-id="${selectedId}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [selectedId, roots]);

  useEffect(() => {
    if (degradedReason !== "LOCAL_DEV_CONTENT_RESERVE" || roots.length === 0) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const root of roots) {
        if ((root.children?.length ?? 0) > 0 && !next.has(root.id)) {
          next.add(root.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [degradedReason, roots]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const onSelectAndNavigate = useCallback(
    async (id: string) => {
      if (navInFlightRef.current) return;
      setHomeNavError(null);

      if (id === HOME_NODE_ID) {
        navInFlightRef.current = true;
        homeNavInFlightRef.current = true;
        try {
          const res = await fetch("/api/backoffice/content/home", { method: "GET", cache: "no-store" });
          const body = (await res.json()) as { ok?: boolean; data?: { page?: { id: string } }; error?: string; message?: string };
          const pageId = body?.data?.page?.id;
          if (res.ok && pageId) {
            onSelectNode(pageId);
            router.push(`${BASE}/${pageId}`);
          } else {
            setHomeNavError(body?.message ?? body?.error ?? "Kunne ikke åpne Hjem.");
          }
        } catch {
          setHomeNavError("Kunne ikke åpne Hjem.");
        } finally {
          homeNavInFlightRef.current = false;
          navInFlightRef.current = false;
        }
        return;
      }

      if (isContentTreeFolderRootId(id)) {
        toggleExpanded(id);
        return;
      }

      if (id === MOCK_RECYCLE_BIN_ID) {
        onSelectNode(null);
        router.push(`${BASE}/recycle-bin`);
        return;
      }

      if (isContentPageUuid(id)) {
        onSelectNode(id);
        router.push(`${BASE}/${id}`);
        return;
      }

      const node = findNode(roots, id);
      const slug = node && typeof node.slug === "string" && node.slug.trim() ? node.slug.trim() : null;
      if (slug) {
        navInFlightRef.current = true;
        try {
          const res = await fetch(
            `/api/backoffice/content/pages/by-slug?slug=${encodeURIComponent(slug)}`,
            { method: "GET", cache: "no-store" },
          );
          const data = (await res.json()) as { ok?: boolean; data?: { id?: string; data?: { id?: string } }; error?: string };
          const pageId = data?.data?.data?.id ?? data?.data?.id;
          if (res.ok && pageId) {
            onSelectNode(pageId);
            router.push(`${BASE}/${pageId}`);
          } else {
            setHomeNavError(data?.error ?? "Finner ikke side med denne slug.");
          }
        } catch {
          setHomeNavError("Kunne ikke åpne side.");
        } finally {
          navInFlightRef.current = false;
        }
        return;
      }
      toggleExpanded(id);
    },
    [router, roots, toggleExpanded, onSelectNode],
  );

  const onCopyLink = useCallback(
    (id: string) => {
      const node = findNode(roots, id);
      const raw = node && typeof node.slug === "string" && node.slug.trim() ? node.slug.trim() : id;
      const url = `${BASE}/${encodeURIComponent(raw)}`;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.setAttribute("readonly", "");
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(ta);
        }
      }
    },
    [roots],
  );

  const onPreview = useCallback((slug: string) => {
    const appPath = getPreviewPathForOverlaySlug(slug);
    const path = appPath ?? `/${encodeURIComponent(slug)}`;
    window.open(path, "_blank", "noopener");
  }, []);

  const onEdit = useCallback(
    (id: string) => {
      const node = findNode(roots, id);
      if (node?.nodeType === "root" && node.targetPageId) {
        void onSelectAndNavigate(node.targetPageId);
        return;
      }
      void onSelectAndNavigate(id);
    },
    [onSelectAndNavigate, roots]
  );

  const onCreateChild = useCallback(
    async (parentId: string) => {
      if (mutationsLocked) {
        setHomeNavError("Tree-mutasjoner er låst mens treet kjører i degradert reservevisning.");
        return;
      }
      setActionsOpenNodeId(null);
      const parentNode = findNode(roots, parentId);
      if (!parentNode) {
        setHomeNavError("Forelder-node finnes ikke i treet.");
        return;
      }
      let parentDocumentTypeAlias: string | null = null;
      let rootKey: ContentTreeRootKey | null = null;
      if (isContentTreeFolderRootId(parentId) && isContentTreeRootKey(parentId)) {
        rootKey = parentId;
      } else if (isContentPageUuid(parentId)) {
        try {
          const readParentBody = async (query: string): Promise<unknown | null> => {
            const res = await fetch(
              `/api/backoffice/content/pages/${encodeURIComponent(parentId)}${query}`,
              {
                method: "GET",
                credentials: "include",
                cache: "no-store",
              },
            );
            const json = (await res.json().catch(() => null)) as
              | { ok?: boolean; data?: { page?: { body?: unknown } } }
              | null;
            if (!res.ok || json?.ok === false) return null;
            return json?.data?.page?.body ?? null;
          };
          const parentBody =
            (await readParentBody("?locale=nb&environment=preview")) ??
            (await readParentBody("?locale=nb&environment=prod")) ??
            (await readParentBody(""));
          if (parentBody == null) {
            setHomeNavError("Kunne ikke lese dokumenttype for valgt forelder.");
            return;
          }
          const envelope = parseBodyEnvelope(parentBody);
          const rawAlias =
            envelope.documentType != null ? String(envelope.documentType).trim() : "";
          parentDocumentTypeAlias = rawAlias || "page";
        } catch {
          setHomeNavError("Kunne ikke lese dokumenttype for valgt forelder.");
          return;
        }
      } else {
        return;
      }
      const allowedAliases = parentDocumentTypeAlias
        ? resolveAllowedChildAliasesForParent(parentDocumentTypeAlias, mergedDocumentTypes)
        : resolveRootCreateAliases(mergedDocumentTypes);
      const options = resolveCreateDialogOptions(allowedAliases, mergedDocumentTypes);
      if (options.length === 0) {
        setHomeNavError("Ingen tillatte dokumenttyper for opprettelse under valgt forelder.");
        return;
      }
      const first = options[0];
      const nextTitle = `Ny ${first.title}`;
      setCreateDialog({
        open: true,
        parentId: isContentPageUuid(parentId) ? parentId : null,
        parentLabel: parentNode.name,
        parentDocumentTypeAlias,
        rootKey,
        options,
        selectedAlias: first.alias,
        title: nextTitle,
        slug: normalizeCreateSlug(nextTitle),
        creating: false,
        error: null,
      });
    },
    [mergedDocumentTypes, mutationsLocked, roots],
  );

  const applyRename = useCallback(
    async (id: string, name: string) => {
      if (mutationsLocked) {
        setHomeNavError("Omdøping er låst mens treet kjører i degradert reservevisning.");
        return;
      }
      if (!isContentPageUuid(id)) return;
      try {
        const res = await fetch(`/api/backoffice/content/pages/${id}`, {
          method: "PATCH",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: name }),
        });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!res.ok || json?.ok === false) {
          setHomeNavError(json?.message ?? "Kunne ikke lagre navn.");
          return;
        }
        await loadTree();
      } catch {
        setHomeNavError("Kunne ikke lagre navn.");
      }
    },
    [loadTree, mutationsLocked],
  );

  const onBeginRename = useCallback((id: string, currentName: string) => {
    setRenameState({ id, draft: currentName });
    setActionsOpenNodeId(null);
  }, []);

  const onRenameDraftChange = useCallback((value: string) => {
    setRenameState((s) => (s ? { ...s, draft: value } : null));
  }, []);

  const cancelRename = useCallback(() => setRenameState(null), []);

  const resolveRename = useCallback(() => {
    setRenameState((s) => {
      if (!s) return null;
      const trimmed = s.draft.trim();
      if (!trimmed) return null;
      void applyRename(s.id, trimmed);
      return null;
    });
  }, [applyRename]);

  const onMove = useCallback((id: string) => {
    if (mutationsLocked) {
      setHomeNavError("Flytting er låst mens treet kjører i degradert reservevisning.");
      return;
    }
    if (getNodePolicy(id).isHome) return;
    const node = findNode(roots, id);
    if (!node || !isContentPageUuid(id)) return;
    setMoveDialog({ pageId: id, name: node.name });
    setActionsOpenNodeId(null);
  }, [mutationsLocked, roots]);

  const onDelete = useCallback(() => {
    setActionsOpenNodeId(null);
  }, []);

  const closeCreateDialog = useCallback(() => {
    setCreateDialog((prev) => ({
      ...prev,
      open: false,
      creating: false,
      error: null,
    }));
  }, []);

  const submitCreateFromDialog = useCallback(async () => {
    if (!createDialog.open || createDialog.creating || !createDialog.selectedAlias) return;
    const title = createDialog.title.trim();
    const slug = normalizeCreateSlug(createDialog.slug);
    if (!title || !slug) {
      setCreateDialog((prev) => ({ ...prev, error: "Tittel og slug er påkrevd." }));
      return;
    }
    const payload: Record<string, unknown> = {
      title,
      slug,
      locale: "nb",
      environment: "preview",
      ...buildCreatePayloadForDocumentType(createDialog.selectedAlias),
    };
    if (createDialog.parentId) {
      payload.tree_parent_id = createDialog.parentId;
    } else if (createDialog.rootKey) {
      payload.tree_root_key = createDialog.rootKey;
    }
    setCreateDialog((prev) => ({ ...prev, creating: true, error: null }));
    try {
      const res = await fetch("/api/backoffice/content/pages", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: {
          page?: { id?: string; tree_parent_id?: string | null; tree_root_key?: string | null };
        };
        message?: string;
      } | null;
      const pagePayload = json?.data?.page;
      const pageId = pagePayload?.id ?? null;
      if (!res.ok || !pageId || json?.ok === false) {
        setCreateDialog((prev) => ({
          ...prev,
          creating: false,
          error: json?.message ?? "Kunne ikke opprette side.",
        }));
        return;
      }
      const parentIdBeforeClose = createDialog.parentId;
      const treeParentCanonical =
        pagePayload?.tree_parent_id !== undefined ? pagePayload.tree_parent_id : parentIdBeforeClose;

      closeCreateDialog();
      setTreeFilter("");
      setLoading(true);
      setLoadError(null);
      try {
        let lastRoots: ContentTreeNode[] = [];
        for (let attempt = 0; attempt < 6; attempt++) {
          const result = await fetchContentTreeEnvelope();
          if (result.ok === false) {
            setHomeNavError(
              result.message ??
                "Kunne ikke oppdatere tre etter opprettelse — åpner redigerer likevel.",
            );
            break;
          }
          applyTreeEnvelope(result.envelope);
          lastRoots = dedupeRootsById(result.envelope.roots);
          const reveal = expandRevealIdsForPostCreate(lastRoots, pageId, treeParentCanonical ?? null);
          setExpandedIds((prev) => new Set([...prev, ...reveal]));
          if (findNode(lastRoots, pageId)) break;
          await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
        }
        if (lastRoots.length > 0 && !findNode(lastRoots, pageId)) {
          setHomeNavError(
            "Ny side vises ikke i treet ennå — oppdater siden eller bruk «Prøv igjen» på tre-feil.",
          );
        }
      } finally {
        setLoading(false);
      }

      onSelectNode(pageId);
      router.push(`${BASE}/${pageId}`);
    } catch {
      setCreateDialog((prev) => ({
        ...prev,
        creating: false,
        error: "Kunne ikke opprette side.",
      }));
    }
  }, [applyTreeEnvelope, closeCreateDialog, createDialog, onSelectNode, router]);

  const filterExpandedIds = useMemo(() => collectExpandedIdsForTreeFilter(roots, treeFilter), [roots, treeFilter]);

  const mergedExpandedIds = useMemo(() => {
    if (!treeFilter.trim()) return expandedIds;
    return new Set([...expandedIds, ...filterExpandedIds]);
  }, [expandedIds, filterExpandedIds, treeFilter]);

  const flat = flattenVisible(roots, mergedExpandedIds);

  const visibleFilterIds = useMemo(() => collectVisibleNodeIdsForTreeFilter(roots, treeFilter), [roots, treeFilter]);

  const flatDisplay = useMemo(() => {
    if (!visibleFilterIds) return flat;
    return flat.filter(({ node }) => visibleFilterIds.has(node.id));
  }, [flat, visibleFilterIds]);

  const showRecycleBinRow = useMemo(() => {
    const q = treeFilter.trim().toLowerCase();
    if (!q) return true;
    return q.includes("recycle") || q.includes("papirkurv") || (q.length >= 3 && q.includes("bin"));
  }, [treeFilter]);

  return (
    <div className="flex flex-col py-2" role="tree" aria-label="Innhold" data-lp-content-tree>
      <div className="px-3 pb-2 pt-1">
        <label className="sr-only" htmlFor="content-tree-filter">
          Søk i innholdstre
        </label>
        <input
          id="content-tree-filter"
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Søk i tre…"
          value={treeFilter}
          onChange={(e) => setTreeFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Innhold
      </div>
      {loadError ? (
        <div className="px-3 py-2 text-xs text-red-600" role="alert">
          {loadError}{" "}
          <button type="button" className="underline" onClick={() => void loadTree()}>
            Prøv igjen
          </button>
        </div>
      ) : null}
      {(schemaHint || operatorMessage || operatorAction || technicalDetail || missingColumns.length > 0 || technicalCode) && !loadError ? (
        <div
          className={`mx-3 mb-2 rounded-xl border px-3 py-3 text-[11px] leading-snug ${
            treeDegraded
              ? "border-amber-300 bg-amber-50/95 text-amber-950"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
          role="status"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                treeDegraded
                  ? "bg-amber-100 text-amber-900"
                  : "bg-white text-slate-700 ring-1 ring-slate-200"
              }`}
            >
              {treeDegraded ? "Tree degradert" : "Schema-fallback"}
            </span>
            {formatTreeDegradedReason(degradedReason) ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-current/80">
                {formatTreeDegradedReason(degradedReason)}
              </span>
            ) : null}
            {mutationsLocked ? (
              <span className="text-[10px] font-medium uppercase tracking-wide text-current/80">
                Mutasjoner låst
              </span>
            ) : null}
          </div>
          {operatorMessage || schemaHint ? (
            <p className="mt-2">{operatorMessage ?? schemaHint}</p>
          ) : null}
          {operatorMessage && schemaHint && operatorMessage !== schemaHint ? (
            <p className="mt-1 text-[10px] text-current/80">{schemaHint}</p>
          ) : null}
          {operatorAction ? (
            <p className="mt-2 rounded-lg border border-current/15 bg-white/60 px-2.5 py-2 text-[10px] font-medium text-current/90">
              Neste steg: {operatorAction}
            </p>
          ) : null}
          {missingColumns.length > 0 ? (
            <p className="mt-1 text-[10px] text-current/80">
              Manglende kolonner: <span className="font-mono">{missingColumns.join(", ")}</span>
            </p>
          ) : null}
          {treeDegraded ? (
            <p className="mt-1 text-[10px] text-current/80">
              Navigasjon holder seg trygg og lesbar, men editoren viser reservevisning til schema er tilbake i sync.
              {mutationsLocked
                ? " Opprett, omdøp og flytt er låst til full trestruktur er tilbake."
                : ""}
            </p>
          ) : null}
          {technicalDetail ? (
            <details className="mt-2 text-[10px] text-current/80">
              <summary className="cursor-pointer font-medium uppercase tracking-wide">
                Teknisk detalj
              </summary>
              {technicalCode ? (
                <p className="mt-1 break-words font-mono">Kode: {technicalCode}</p>
              ) : null}
              <p className="mt-1 break-words font-mono">{technicalDetail}</p>
            </details>
          ) : null}
        </div>
      ) : null}
      {loading && !roots.length ? (
        <div className="px-3 py-2 text-xs text-slate-500" aria-live="polite">
          Laster tre…
        </div>
      ) : null}
      {!loading && !loadError && roots.length === 0 ? (
        <div className="px-3 py-2 text-xs text-slate-600" role="status">
          Treet er tomt. Sjekk at migrasjon for <code className="text-[11px]">content_pages</code> er kjørt og at API-et kan lese
          noder. Bruk «Prøv igjen» hvis schema eller cache nylig er endret.
        </div>
      ) : null}
      {homeNavError ? (
        <div className="px-3 py-1 text-xs text-red-600" role="alert">
          {homeNavError}
        </div>
      ) : null}
      {flatDisplay.map(({ node, level }) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          level={level}
          isSelected={isRowSelected(node, selectedId)}
          isExpanded={expandedIds.has(node.id)}
          selectedId={selectedId}
          expandedIds={mergedExpandedIds}
          basePath={BASE}
          onSelectAndNavigate={onSelectAndNavigate}
          onToggleExpand={toggleExpanded}
          onRowClick={(id) => {
            if (isContentPageUuid(id)) onSelectNode(id);
          }}
          permissions={permissionsForNode(node, mutationsLocked)}
          onEdit={onEdit}
          onCopyLink={onCopyLink}
          onPreview={onPreview}
          onCreateChild={onCreateChild}
          onRename={onBeginRename}
          onMove={onMove}
          onDelete={onDelete}
          actionsOpenNodeId={actionsOpenNodeId}
          onOpenActions={setActionsOpenNodeId}
          isRenamingThisNode={renameState?.id === node.id}
          renameDraft={renameState?.id === node.id ? renameState.draft : ""}
          onRenameDraftChange={onRenameDraftChange}
          onRenameCommit={() => void resolveRename()}
          onRenameCancel={cancelRename}
          onRenameBlur={() => void resolveRename()}
        />
      ))}
      {showRecycleBinRow ? (
        <TreeNodeRow
          node={{
            id: MOCK_RECYCLE_BIN_ID,
            parentId: null,
            name: "Recycle Bin",
            hasChildren: false,
          }}
          level={0}
          isSelected={selectedId === MOCK_RECYCLE_BIN_ID}
          isExpanded={false}
          selectedId={selectedId}
          expandedIds={mergedExpandedIds}
          basePath={BASE}
          onSelectAndNavigate={() => {
            onSelectNode(null);
            router.push(`${BASE}/recycle-bin`);
          }}
          onToggleExpand={() => {}}
          onRowClick={() => {}}
          permissions={{ canCreate: false, canRename: false, canMove: false, canDelete: false }}
          onEdit={() => {
            onSelectNode(null);
            router.push(`${BASE}/recycle-bin`);
          }}
          onCopyLink={onCopyLink}
          onPreview={() => {}}
          onCreateChild={() => {}}
          onRename={() => {}}
          onMove={() => {}}
          onDelete={() => {}}
          actionsOpenNodeId={actionsOpenNodeId}
          onOpenActions={setActionsOpenNodeId}
          isRenamingThisNode={false}
          renameDraft=""
          onRenameDraftChange={() => {}}
          onRenameCommit={() => {}}
          onRenameCancel={() => {}}
          onRenameBlur={() => {}}
        />
      ) : null}
      {createDialog.open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default border-0 bg-black/20 p-0"
            aria-label="Lukk opprett-dialog"
            onClick={closeCreateDialog}
          />
          <div
            className="fixed right-4 top-16 z-50 w-[min(92vw,480px)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
            role="dialog"
            aria-modal="true"
            data-lp-create-child-dialog
            data-lp-create-child-parent-id={createDialog.parentId ?? createDialog.rootKey ?? ""}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Opprett under {createDialog.parentLabel}
              </h2>
              <button
                type="button"
                onClick={closeCreateDialog}
                className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                Lukk
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Velg dokumenttype. Kun typer tillatt av struktur-regelen vises.
            </p>
            <div className="mt-3 max-h-52 space-y-2 overflow-auto">
              {createDialog.options.map((opt) => {
                const selected = createDialog.selectedAlias === opt.alias;
                return (
                  <button
                    key={opt.alias}
                    type="button"
                    data-lp-create-child-option
                    data-lp-create-child-option-alias={opt.alias}
                    onClick={() =>
                      setCreateDialog((prev) => ({
                        ...prev,
                        selectedAlias: opt.alias,
                        title: `Ny ${opt.title}`,
                        slug: normalizeCreateSlug(`ny-${opt.alias}`),
                      }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-left ${
                      selected ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-900">
                      {opt.title} <span className="font-mono text-xs text-slate-500">({opt.alias})</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-600">{opt.description}</p>
                    {opt.templateBindingAlias ? (
                      <p
                        className="mt-1 text-[11px] text-slate-500"
                        data-lp-template-binding
                        data-lp-template-binding-alias={opt.templateBindingAlias}
                      >
                        Rendering: <span>{opt.templateBindingAlias}</span>
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <label className="mt-3 block text-xs font-medium text-slate-700">
              Tittel
              <input
                value={createDialog.title}
                onChange={(e) =>
                  setCreateDialog((prev) => ({
                    ...prev,
                    title: e.target.value,
                    slug: normalizeCreateSlug(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Ny side"
              />
            </label>
            <label className="mt-2 block text-xs font-medium text-slate-700">
              Slug
              <input
                value={createDialog.slug}
                onChange={(e) => setCreateDialog((prev) => ({ ...prev, slug: normalizeCreateSlug(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                placeholder="ny-side"
              />
            </label>
            {createDialog.error ? (
              <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
                {createDialog.error}
              </p>
            ) : null}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCreateDialog}
                className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700"
              >
                Avbryt
              </button>
              <button
                type="button"
                onClick={() => void submitCreateFromDialog()}
                disabled={createDialog.creating || !createDialog.selectedAlias}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {createDialog.creating ? "Oppretter…" : "Opprett"}
              </button>
            </div>
          </div>
        </>
      ) : null}
      {moveDialog ? (
        <ContentTreeMoveDialog
          open={true}
          pageId={moveDialog.pageId}
          pageName={moveDialog.name}
          roots={roots}
          onClose={() => setMoveDialog(null)}
          onCompleted={() => void loadTree()}
        />
      ) : null}
    </div>
  );
}

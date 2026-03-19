"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getMockRoots,
  MOCK_RECYCLE_BIN_ID,
  flattenVisible,
  findNode,
  removeNodeFromTree,
  addChildToTree,
} from "./treeMock";
import type { ContentTreeNode, TreePermissions } from "./treeTypes";
import { TreeNodeRow } from "./TreeNodeRow";
import { getPreviewPathForOverlaySlug } from "@/lib/cms/overlays/registry";

const BASE = "/backoffice/content";

/** Folder nodes: expand/collapse only, no navigation. */
const FOLDER_IDS = ["overlays", "global", "design"] as const;

/** Client-safe UUID check for page IDs (match lib/cms/public/getPageIdBySlug). */
function isContentPageId(id: string): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(id);
}

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `n_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/** Home root node policy (Umbraco 13 parity). Delete/Move are hard-locked for Home. */
function getNodePolicy(nodeId: string) {
  const isHome =
    nodeId === "home" || nodeId === "root" || nodeId === "home-root";
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

function permissionsForNode(node: ContentTreeNode): TreePermissions {
  const policy = getNodePolicy(node.id);
  return {
    canCreate: policy.canCreate,
    canRename: policy.canRename,
    canMove: policy.canMove,
    canDelete: policy.canDelete,
  };
}

const HOME_NODE_ID = "home";

export default function ContentTree({
  selectedNodeId,
  onSelectNode,
}: {
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const [roots, setRoots] = useState<ContentTreeNode[]>(getMockRoots);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [actionsOpenNodeId, setActionsOpenNodeId] = useState<string | null>(null);
  const [homeNavError, setHomeNavError] = useState<string | null>(null);
  const homeNavInFlightRef = useRef(false);
  const navInFlightRef = useRef(false);

  const pathnameSelectedId = pathname.startsWith(BASE + "/recycle-bin")
    ? MOCK_RECYCLE_BIN_ID
    : pathname === BASE
      ? null
      : pathname.replace(BASE + "/", "").split("/")[0] ?? null;
  const selectedId = selectedNodeId ?? pathnameSelectedId;

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

      if (FOLDER_IDS.includes(id as (typeof FOLDER_IDS)[number])) {
        toggleExpanded(id);
        return;
      }

      if (id === MOCK_RECYCLE_BIN_ID) {
        onSelectNode(null);
        router.push(`${BASE}/recycle-bin`);
        return;
      }

      const node = findNode(roots, id);
      if (isContentPageId(id)) {
        onSelectNode(id);
        router.push(`${BASE}/${id}`);
        return;
      }
      const slug = node && typeof node.slug === "string" && node.slug.trim() ? node.slug.trim() : null;
      if (slug) {
        navInFlightRef.current = true;
        try {
          const res = await fetch(
            `/api/backoffice/content/pages/by-slug?slug=${encodeURIComponent(slug)}`,
            { method: "GET", cache: "no-store" }
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
    [router, roots, toggleExpanded, onSelectNode]
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
    [roots]
  );

  const onPreview = useCallback((slug: string) => {
    const appPath = getPreviewPathForOverlaySlug(slug);
    const path = appPath ?? `/${encodeURIComponent(slug)}`;
    window.open(path, "_blank", "noopener");
  }, []);

  const onCreateChild = useCallback((parentId: string) => {
    const parent = findNode(roots, parentId);
    if (!parent) return;
    const child: ContentTreeNode = {
      id: makeId(),
      parentId: parent.id,
      name: "Ny side",
      hasChildren: false,
      icon: "document",
    };
    setRoots((r) => addChildToTree(r, parentId, child));
    setExpandedIds((prev) => new Set(prev).add(parentId));
    setActionsOpenNodeId(null);
  }, [roots]);

  const onRename = useCallback((id: string, currentName: string) => {
    const nextName = window.prompt("Nytt navn", currentName);
    if (nextName == null || nextName.trim() === "") return;
    const name = nextName.trim();
    setRoots((r) =>
      r.map((root) => {
        function map(n: ContentTreeNode): ContentTreeNode {
          if (n.id === id) return { ...n, name };
          return { ...n, children: n.children?.map(map) };
        }
        return map(root);
      })
    );
    setActionsOpenNodeId(null);
  }, []);

  const onMove = useCallback((id: string) => {
    if (getNodePolicy(id).isHome) return;
    setActionsOpenNodeId(null);
  }, []);

  const onDelete = useCallback((id: string) => {
    if (getNodePolicy(id).isHome) return;
    setRoots((r) => removeNodeFromTree(r, id));
    setActionsOpenNodeId(null);
  }, []);

  const flat = flattenVisible(roots, expandedIds);

  return (
    <div className="flex flex-col py-2" role="tree" aria-label="Innhold">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Innhold
      </div>
      {homeNavError ? (
        <div className="px-3 py-1 text-xs text-red-600" role="alert">
          {homeNavError}
        </div>
      ) : null}
      {flat.map(({ node, level }) => (
        <TreeNodeRow
          key={node.id}
          node={node}
          level={level}
          isSelected={selectedId === node.id}
          isExpanded={expandedIds.has(node.id)}
          selectedId={selectedId}
          expandedIds={expandedIds}
          basePath={BASE}
          onSelectAndNavigate={onSelectAndNavigate}
          onToggleExpand={toggleExpanded}
          onRowClick={(id) => {
            // Only select "editor-ready" UUID nodes; folders/actions keep the current selection.
            if (isContentPageId(id)) onSelectNode(id);
          }}
          permissions={permissionsForNode(node)}
          onCopyLink={onCopyLink}
          onPreview={onPreview}
          onCreateChild={onCreateChild}
          onRename={onRename}
          onMove={onMove}
          onDelete={onDelete}
          actionsOpenNodeId={actionsOpenNodeId}
          onOpenActions={setActionsOpenNodeId}
        />
      ))}
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
        expandedIds={expandedIds}
        basePath={BASE}
        onSelectAndNavigate={(id) => router.push(`${BASE}/${id}`)}
        onToggleExpand={() => {}}
        onRowClick={() => {}}
        permissions={{ canCreate: false, canRename: false, canMove: false, canDelete: false }}
        onCopyLink={onCopyLink}
        onPreview={() => {}}
        onCreateChild={() => {}}
        onRename={() => {}}
        onMove={() => {}}
        onDelete={() => {}}
        actionsOpenNodeId={actionsOpenNodeId}
        onOpenActions={setActionsOpenNodeId}
      />
    </div>
  );
}



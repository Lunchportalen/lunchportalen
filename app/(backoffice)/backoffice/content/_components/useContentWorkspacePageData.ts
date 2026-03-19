/**
 * List and detail page loading orchestration for ContentWorkspace.
 * Owns: items, list state, page, detail state, refetch keys.
 * Callbacks: onPageLoaded, onReset, onPageError — ContentWorkspace applies editor/save state.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PageStatus } from "./contentTypes";
import { safeStr } from "./contentWorkspace.helpers";
import { ApiOk, readApiError, parseJsonSafe } from "./contentWorkspace.api";
import { parseBodyEnvelope, serializeBodyEnvelope, isForside } from "./_stubs";
import { parseBodyToBlocks, deriveBodyFromParse, type BodyParseResult } from "./contentWorkspace.blocks";

// Minimal types for list/detail API (no dependency on ContentWorkspace)
export type ContentPageListItem = {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  updated_at: string | null;
};

export type ContentPage = {
  id: string;
  title: string;
  slug: string;
  body: unknown;
  status: PageStatus;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

type ListData = { items: ContentPageListItem[] };
type PageData = { page: ContentPage };

export type PageLoadedData = {
  page: ContentPage;
  nextTitle: string;
  nextSlug: string;
  envelope: { documentType: string | null; fields: Record<string, unknown>; blocksBody: unknown };
  parsedBody: BodyParseResult;
  snapshotBody: string;
  updated_at: string | null;
};

export type PageErrorPayload = {
  message?: string;
  isParseLike?: boolean;
};

export type UseContentWorkspacePageDataParams = {
  selectedId: string;
  query: string;
  /** ContentWorkspace owns page state; hook calls this when detail load succeeds. */
  setPage: (page: ContentPage | null) => void;
  onPageLoaded: (data: PageLoadedData) => void;
  onReset: () => void;
  /** Called when detail load fails (404 or network/parse). ContentWorkspace clears save/outbox and optionally logs. */
  onPageError?: (payload: PageErrorPayload) => void;
  /** Called when detail load starts (e.g. to clear lastError/lastSavedAt). */
  onDetailLoadStart?: () => void;
};

export function useContentWorkspacePageData({
  selectedId,
  query,
  setPage: setPageFromProps,
  onPageLoaded,
  onReset,
  onPageError,
  onDetailLoadStart,
}: UseContentWorkspacePageDataParams) {
  const [items, setItems] = useState<ContentPageListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listReloadKey, setListReloadKey] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pageNotFound, setPageNotFound] = useState(false);
  const [refetchDetailKey, setRefetchDetailKey] = useState(0);
  const detailRunIdRef = useRef(0);

  const updateSidebarItem = useCallback((next: ContentPage) => {
    setItems((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      let changed = false;
      const nextItems = prev.map((entry) => {
        if (entry.id !== next.id) return entry;
        changed = true;
        return {
          ...entry,
          title: safeStr(next.title),
          slug: safeStr(next.slug),
          status: next.status,
          updated_at: next.updated_at ?? entry.updated_at,
        };
      });
      return changed ? nextItems : prev;
    });
  }, []);

  // List: syncAndLoadList
  useEffect(() => {
    let active = true;

    async function syncAndLoadList() {
      setListLoading(true);
      setListError(null);
      const qs = query ? `?query=${encodeURIComponent(query)}` : "";

      try {
        const res = await fetch(`/api/backoffice/content/pages${qs}`, {
          method: "GET",
          cache: "no-store",
        });
        const payload = await parseJsonSafe<ListData>(res);

        const raw = payload as unknown;
        let loadedItems: ContentPageListItem[] =
          Array.isArray((raw as { data?: { items?: ContentPageListItem[] } })?.data?.items)
            ? (raw as { data: { items: ContentPageListItem[] } }).data.items
            : Array.isArray((raw as { items?: ContentPageListItem[] })?.items)
              ? (raw as { items: ContentPageListItem[] }).items
              : Array.isArray((raw as { pages?: ContentPageListItem[] })?.pages)
                ? (raw as { pages: ContentPageListItem[] }).pages
                : [];

        if (!res.ok || !payload || (payload as { ok?: boolean }).ok !== true) {
          throw new Error(readApiError(res.status, payload, "Kunne ikke hente sider."));
        }

        const hasForside = loadedItems.some((item) => isForside(item.slug, item.title));
        if (!hasForside && loadedItems.length >= 0) {
          try {
            const createRes = await fetch("/api/backoffice/content/pages", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: "Lunchportalen – firmalunsj med kontroll og forutsigbarhet",
                slug: "front",
              }),
            });
            const createPayload = await parseJsonSafe<{ ok?: boolean; data?: { page?: ContentPageListItem } }>(createRes);
            const raw = createPayload as { ok?: boolean; data?: { page?: ContentPageListItem } } | null;
            const created = raw?.ok === true ? (raw.data?.page ?? (raw as { item?: ContentPageListItem }).item) : undefined;
            if (createRes.ok && created) {
              loadedItems = [created, ...loadedItems];
            }
          } catch {
            // Ignore: forside creation might fail (e.g. duplicate). List stays as-is.
          }
        }
        loadedItems = [...loadedItems].sort((a, b) => {
          const aFirst = isForside(a.slug, a.title);
          const bFirst = isForside(b.slug, b.title);
          if (aFirst && !bFirst) return -1;
          if (!aFirst && bFirst) return 1;
          return (a.title || "").localeCompare(b.title || "", "nb");
        });

        if (!active) return;
        setItems(loadedItems);
        setListError(null);
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke hente sider.";
        setItems([]);
        setListError(message || "Kunne ikke hente sider.");
      } finally {
        if (active) setListLoading(false);
      }
    }

    void syncAndLoadList();
    return () => {
      active = false;
    };
  }, [query, listReloadKey]);

  // Detail: reset when !selectedId; load when selectedId
  useEffect(() => {
    if (!selectedId) {
      setPageFromProps(null);
      setDetailError(null);
      setPageNotFound(false);
      setDetailLoading(false);
      onReset();
      return;
    }

    const runId = ++detailRunIdRef.current;
    let active = true;

    async function loadPage() {
      setDetailLoading(true);
      setDetailError(null);
      onDetailLoadStart?.();

      try {
        const res = await fetch(
          `/api/backoffice/content/pages/${encodeURIComponent(selectedId)}?environment=preview&locale=nb`,
          { method: "GET", cache: "no-store" }
        );
        const payload = await parseJsonSafe<PageData>(res);

        if (res.status === 404) {
          if (!active || runId !== detailRunIdRef.current) return;
          setPageFromProps(null);
          setDetailError(null);
          setPageNotFound(true);
          setDetailLoading(false);
          onPageError?.({});
          return;
        }

        if (!payload || (payload as { ok?: boolean }).ok !== true) {
          throw new Error(readApiError(res.status, payload, "Kunne ikke hente side."));
        }

        if (!active || runId !== detailRunIdRef.current) return;

        const data = (payload as ApiOk<PageData>).data;
        const next = data.page;
        if (next == null || next === undefined) {
          if (runId !== detailRunIdRef.current) return;
          setPageFromProps(null);
          setDetailError(null);
          setPageNotFound(true);
          setDetailLoading(false);
          onPageError?.({ message: "Kunne ikke hente side." });
          return;
        }

        if (runId !== detailRunIdRef.current) return;
        setPageNotFound(false);
        const nextTitle = safeStr(next.title);
        const nextSlug = safeStr(next.slug);
        const envelope = parseBodyEnvelope(next.body);
        const parsedBody = parseBodyToBlocks(envelope.blocksBody);
        const snapshotBody =
          envelope.documentType != null
            ? serializeBodyEnvelope({
                documentType: envelope.documentType,
                fields: envelope.fields,
                blocksBody: deriveBodyFromParse(parsedBody),
              })
            : deriveBodyFromParse(parsedBody);

        setPageFromProps(next);
        onPageLoaded({
          page: next,
          nextTitle,
          nextSlug,
          envelope: {
            documentType: envelope.documentType,
            fields: envelope.fields,
            blocksBody: envelope.blocksBody,
          },
          parsedBody,
          snapshotBody: typeof snapshotBody === "string" ? snapshotBody : String(snapshotBody),
          updated_at: next.updated_at ?? null,
        });
      } catch (err) {
        if (!active || runId !== detailRunIdRef.current) return;
        const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke hente side.";
        const isParseLike =
          err instanceof Error && /parse|json|body|envelope|block/i.test(err.message);
        setPageFromProps(null);
        setDetailError(message || "Kunne ikke hente side.");
        setPageNotFound(true);
        onPageError?.({ message: message || "Kunne ikke hente side.", isParseLike });
      } finally {
        if (active && runId === detailRunIdRef.current) setDetailLoading(false);
      }
    }

    void loadPage();
    return () => {
      active = false;
    };
    // Intentionally omit onPageLoaded, onReset, onPageError, onDetailLoadStart, setPageFromProps from deps.
    // ContentWorkspace wraps the real callbacks in refs and passes new function identities on each render.
    // Including them here would make this effect run after every successful load (because onPageLoaded mutates
    // editor state, which triggers a re-render and new wrappers), causing a request loop. We only want to run
    // when selectedId or refetchDetailKey change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, refetchDetailKey]);

  return {
    items,
    setItems,
    listLoading,
    listError,
    listReloadKey,
    setListReloadKey,
    detailLoading,
    detailError,
    pageNotFound,
    refetchDetailKey,
    setRefetchDetailKey,
    updateSidebarItem,
  };
}

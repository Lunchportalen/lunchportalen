/**
 * Workspace dataflow: list load, detail load, route navigation helpers, detail→editor sync (via ref),
 * and route-driven UI side effects (history preview reset, URL block focus).
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { isForside } from "./_stubs";
import type { ApiOk } from "./contentWorkspace.api";
import { parseJsonSafe, readApiError } from "./contentWorkspace.api";
import { cmsPageDetailQueryString, normalizeEditorLocale } from "./contentWorkspace.preview";
import { ensureMissingStorageLocaleVariant } from "./contentWorkspace.ensureVariantLocale";
import { parseBodyEnvelope } from "./_stubs";
import { parseBodyToBlocks, snapshotBodyFromPageBody, type BodyParseResult } from "./contentWorkspace.blocks";
import { listInvariantPropertyAliases, normalizeEditorFieldLayers } from "@/lib/cms/contentNodeEnvelope";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { looksMojibakeAny, makeSnapshot, safeStr } from "./contentWorkspace.helpers";
import { clearOutbox, fingerprintOutboxDraft, readOutbox, type OutboxDraft, type OutboxEntry } from "./contentWorkspace.outbox";
import type { BackofficeContentEntityWorkspaceViewId } from "@/lib/cms/backofficeExtensionRegistry";
import type { ContentPageListItem, ContentPage, ListData, PageData } from "./ContentWorkspaceState";
import type { ContentWorkspaceDetailLoadRef } from "./contentWorkspaceDetailLoadRef";
import type { SaveState } from "./types";
import type { Block } from "./editorBlockTypes";
import type { BodyMode } from "./contentWorkspace.blocks";

type MainView = BackofficeContentEntityWorkspaceViewId;

export type ContentWorkspaceNavigationInput = {
  router: { push: (href: string) => void };
  /** Current page id from route (UUID). */
  routeSelectedId: string;
  loadedPage: ContentPage | null;
  dirty: boolean;
  isOffline: boolean;
  clearAutosaveTimer: () => void;
  setPendingNavigationHref: Dispatch<SetStateAction<string | null>>;
  setMainView: (next: MainView) => void;
};

/** Setters/refs the dataflow layer uses to apply GET detail → editor state (shell supplies; sequencing lives here). */
export type ContentWorkspaceEditorSyncInput = {
  setPage: Dispatch<SetStateAction<ContentPage | null>>;
  setTitle: Dispatch<SetStateAction<string>>;
  setSlug: Dispatch<SetStateAction<string>>;
  setSlugTouched: Dispatch<SetStateAction<boolean>>;
  setDocumentTypeAlias: Dispatch<SetStateAction<string | null>>;
  setInvariantEnvelopeFields: Dispatch<SetStateAction<Record<string, unknown>>>;
  setCultureEnvelopeFields: Dispatch<SetStateAction<Record<string, unknown>>>;
  applyParsedBody: (parsed: BodyParseResult) => void;
  setLastServerUpdatedAt: Dispatch<SetStateAction<string | null>>;
  setSaveStateSafe: (next: SaveState) => void;
  setLastError: Dispatch<SetStateAction<string | null>>;
  setLastSavedAt: Dispatch<SetStateAction<string | null>>;
  setSavedSnapshot: Dispatch<SetStateAction<string | null>>;
  skipNextAutosaveScheduleRef: MutableRefObject<boolean>;
  setOutboxData: Dispatch<SetStateAction<OutboxEntry | null>>;
  setRecoveryBannerVisible: Dispatch<SetStateAction<boolean>>;
  setBodyMode: Dispatch<SetStateAction<BodyMode>>;
  setBlocks: Dispatch<SetStateAction<Block[]>>;
  setMeta: Dispatch<SetStateAction<Record<string, unknown>>>;
  setLegacyBodyText: Dispatch<SetStateAction<string>>;
  setInvalidBodyRaw: Dispatch<SetStateAction<string>>;
  setBodyParseError: Dispatch<SetStateAction<string | null>>;
  setSelectedBlockId: Dispatch<SetStateAction<string | null>>;
};

export type ContentWorkspaceRouteUiInput = {
  initialFocusBlockId?: string;
  blocks: Block[];
  setSelectedBlockId: Dispatch<SetStateAction<string | null>>;
  /** Runs when route-selected page id changes (e.g. clear history preview). */
  onRoutePageIdChange?: () => void;
};

export type UseContentWorkspaceDataParams = {
  query: string;
  selectedId: string;
  setPage: Dispatch<SetStateAction<ContentPage | null>>;
  navigation: ContentWorkspaceNavigationInput;
  editorSync: ContentWorkspaceEditorSyncInput;
  routeUi?: ContentWorkspaceRouteUiInput;
  /** U98 — storage locale for variant GET/PATCH (nb | en). */
  editorLocale: string;
  mergedDocumentTypeDefinitions: Record<string, DocumentTypeDefinition> | null;
  /** Latest invariant inspector state (same page) — preserved across locale refetch for unsaved edits. */
  invariantEnvelopeMirrorRef: MutableRefObject<Record<string, unknown>>;
  /** Page id last applied via applyLoadedPage; null until first load. */
  lastLoadedDetailPageIdRef: MutableRefObject<string | null>;
};

function assignDetailLoadRef(
  ref: MutableRefObject<ContentWorkspaceDetailLoadRef | null>,
  sync: ContentWorkspaceEditorSyncInput,
  meta?: {
    lastLoadedDetailPageIdRef: MutableRefObject<string | null>;
  },
): void {
  ref.current = {
    clearWorkspaceWhenNoPage: () => {
      if (meta?.lastLoadedDetailPageIdRef) {
        meta.lastLoadedDetailPageIdRef.current = null;
      }
      sync.setPage(null);
      sync.setTitle("");
      sync.setSlug("");
      sync.setSlugTouched(false);
      sync.setDocumentTypeAlias(null);
      sync.setInvariantEnvelopeFields({});
      sync.setCultureEnvelopeFields({});
      sync.setBodyMode("blocks");
      sync.setBlocks([]);
      sync.setMeta({});
      sync.setLegacyBodyText("");
      sync.setInvalidBodyRaw("");
      sync.setBodyParseError(null);
      sync.setSelectedBlockId(null);
      sync.setLastError(null);
      sync.setLastSavedAt(null);
      sync.setLastServerUpdatedAt(null);
      sync.setSaveStateSafe("idle");
      sync.setSavedSnapshot(null);
      sync.setOutboxData(null);
      sync.setRecoveryBannerVisible(false);
    },
    onBeforeDetailFetch: () => {
      sync.setLastError(null);
      sync.setLastSavedAt(null);
    },
    applyNotFound: () => {
      sync.setPage(null);
      sync.setSavedSnapshot(null);
      sync.setOutboxData(null);
      sync.setRecoveryBannerVisible(false);
    },
    applyLoadError: (_message: string) => {
      sync.setPage(null);
      sync.setSavedSnapshot(null);
      sync.setOutboxData(null);
      sync.setRecoveryBannerVisible(false);
    },
    applyLoadedPage: (args) => {
      const { nextTitle, nextSlug, envelope, parsedBody, snapshotBody } = args;
      const next = args.page;
      if (meta?.lastLoadedDetailPageIdRef) {
        meta.lastLoadedDetailPageIdRef.current = next.id;
      }
      sync.setDocumentTypeAlias(envelope.documentType);
      sync.setInvariantEnvelopeFields(envelope.invariantFields);
      sync.setCultureEnvelopeFields(envelope.cultureFields);
      sync.setTitle(nextTitle);
      sync.setSlug(nextSlug);
      sync.setSlugTouched(false);
      sync.applyParsedBody(parsedBody);
      sync.setLastServerUpdatedAt(next.updated_at ?? null);
      sync.setSaveStateSafe("idle");
      sync.setLastError(null);
      sync.setSavedSnapshot(makeSnapshot({ title: nextTitle, slug: nextSlug, body: snapshotBody }));
      sync.skipNextAutosaveScheduleRef.current = true;
      const outbox = readOutbox(next.id);
      if (outbox && looksMojibakeAny(outbox)) {
        clearOutbox(next.id);
        sync.setOutboxData(null);
        sync.setRecoveryBannerVisible(false);
      } else if (outbox) {
        const serverUpdated = next.updated_at ?? "";
        const localTs = Date.parse(outbox.savedAtLocal);
        const serverTs = Date.parse(serverUpdated);
        const bothValid = Number.isFinite(localTs) && Number.isFinite(serverTs);
        const localOlderOrEqual = !bothValid || localTs <= serverTs;
        if (localOlderOrEqual) {
          clearOutbox(next.id);
          sync.setOutboxData(null);
          sync.setRecoveryBannerVisible(false);
        } else {
          const serverDraft: OutboxDraft = {
            title: nextTitle,
            slug: nextSlug,
            status: next.status,
            body:
              typeof snapshotBody === "string" ? snapshotBody : JSON.stringify(snapshotBody),
          };
          const serverFp = fingerprintOutboxDraft(serverDraft);
          if (outbox.fingerprint === serverFp) {
            clearOutbox(next.id);
            sync.setOutboxData(null);
            sync.setRecoveryBannerVisible(false);
          } else {
            clearOutbox(next.id);
            sync.setOutboxData(null);
            sync.setRecoveryBannerVisible(false);
          }
        }
      } else {
        sync.setOutboxData(null);
        sync.setRecoveryBannerVisible(false);
      }
    },
  };
}

export function useContentWorkspaceData({
  query,
  selectedId,
  setPage,
  navigation,
  editorSync,
  routeUi,
  editorLocale,
  mergedDocumentTypeDefinitions,
  invariantEnvelopeMirrorRef,
  lastLoadedDetailPageIdRef,
}: UseContentWorkspaceDataParams) {
  const [items, setItems] = useState<ContentPageListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [listReloadKey, setListReloadKey] = useState(0);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [pageNotFound, setPageNotFound] = useState(false);
  const [refetchDetailKey, setRefetchDetailKey] = useState(0);
  const detailRunIdRef = useRef(0);

  const detailLoadRef = useRef<ContentWorkspaceDetailLoadRef | null>(null);
  const editorSyncRef = useRef(editorSync);
  editorSyncRef.current = editorSync;
  assignDetailLoadRef(detailLoadRef, editorSyncRef.current, {
    lastLoadedDetailPageIdRef,
  });

  const mergedDocRef = useRef(mergedDocumentTypeDefinitions);
  mergedDocRef.current = mergedDocumentTypeDefinitions;

  const navRef = useRef(navigation);
  navRef.current = navigation;

  const guardPush = useCallback((href: string): void => {
    const n = navRef.current;
    if (n.dirty) {
      n.setPendingNavigationHref(href);
      return;
    }
    n.clearAutosaveTimer();
    n.router.push(href);
  }, []);

  const selectContentPage = useCallback(
    (nextId: string, _slugForUrl?: string) => {
      const n = navRef.current;
      n.setMainView("content");
      const isSamePage = !nextId || nextId === n.loadedPage?.id || nextId === n.routeSelectedId;
      if (isSamePage) return;
      guardPush(`/backoffice/content/${nextId}`);
    },
    [guardPush]
  );

  const reloadDetailFromServer = useCallback(() => {
    const n = navRef.current;
    if (n.isOffline) return;
    n.clearAutosaveTimer();
    setRefetchDetailKey((k) => k + 1);
  }, []);

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

        const raw = payload as unknown as {
          data?: { items?: ContentPageListItem[] };
          items?: ContentPageListItem[];
          pages?: ContentPageListItem[];
        } | null;
        let loadedItems: ContentPageListItem[] = Array.isArray(raw?.data?.items)
          ? raw.data.items
          : Array.isArray(raw?.items)
            ? raw.items
            : Array.isArray(raw?.pages)
              ? raw.pages
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
            const createPayload = await parseJsonSafe<{ ok?: boolean; item?: ContentPageListItem }>(createRes);
            const rawC = createPayload as { ok?: boolean; item?: ContentPageListItem } | null;
            const created = rawC?.ok === true ? rawC.item : undefined;
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

  // Detail load: deps [selectedId, refetchDetailKey, setPage] only — intentionally omit unstable editor callbacks
  // (would retrigger fetch loops if included). detailRunIdRef invalidates stale async completions.
  useEffect(() => {
    if (!selectedId) {
      detailRunIdRef.current += 1;
      detailLoadRef.current?.clearWorkspaceWhenNoPage();
      setDetailError(null);
      setPageNotFound(false);
      setDetailLoading(false);
      return;
    }

    const runId = ++detailRunIdRef.current;
    let active = true;

    async function loadPage(retriedAfterSeed = false) {
      detailLoadRef.current?.onBeforeDetailFetch();
      setDetailLoading(true);
      setDetailError(null);

      try {
        const loc = normalizeEditorLocale(editorLocale);
        const res = await fetch(
          `/api/backoffice/content/pages/${encodeURIComponent(selectedId)}?${cmsPageDetailQueryString(loc)}`,
          { method: "GET", cache: "no-store" }
        );
        const payload = await parseJsonSafe<PageData>(res);

        if (res.status === 404) {
          const p = payload as { error?: string } | null;
          const errRaw = p && typeof p === "object" && p.error != null ? String(p.error) : "";
          if (
            !retriedAfterSeed &&
            errRaw === "VARIANT_NOT_FOUND" &&
            loc === "en" &&
            selectedId
          ) {
            const seeded = await ensureMissingStorageLocaleVariant({
              pageId: selectedId,
              targetLocale: "en",
            });
            if (seeded.ok) {
              return loadPage(true);
            }
          }
          if (!active || runId !== detailRunIdRef.current) return;
          detailLoadRef.current?.applyNotFound();
          setDetailError(null);
          setPageNotFound(true);
          setDetailLoading(false);
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
          detailLoadRef.current?.applyNotFound();
          setDetailError(null);
          setPageNotFound(true);
          setDetailLoading(false);
          return;
        }

        if (runId !== detailRunIdRef.current) return;

        setPageNotFound(false);
        const nextTitle = safeStr(next.title);
        const nextSlug = safeStr(next.slug);
        const envelopeRaw = parseBodyEnvelope(next.body);
        const docAlias = envelopeRaw.documentType != null ? String(envelopeRaw.documentType).trim() : "";
        const merged = mergedDocRef.current;
        const docForLayers =
          docAlias && merged && merged[docAlias] ? merged[docAlias]! : null;
        const parsedLayers = normalizeEditorFieldLayers(next.body, docForLayers);
        let invariantFields = parsedLayers.invariantFields;
        const { cultureFields } = parsedLayers;
        const invAliases = listInvariantPropertyAliases(docForLayers);
        const samePageAsLastLoad = lastLoadedDetailPageIdRef.current === selectedId;
        const priorInv = samePageAsLastLoad ? invariantEnvelopeMirrorRef.current : {};
        if (invAliases.length > 0 && priorInv && typeof priorInv === "object") {
          const mergedInv = { ...invariantFields };
          for (const alias of invAliases) {
            if (Object.prototype.hasOwnProperty.call(priorInv, alias)) {
              mergedInv[alias] = (priorInv as Record<string, unknown>)[alias];
            }
          }
          invariantFields = mergedInv;
        }
        const parsedBody = parseBodyToBlocks(envelopeRaw.blocksBody);
        const snapshotBody = snapshotBodyFromPageBody(next.body);

        setPage(next);
        detailLoadRef.current?.applyLoadedPage({
          page: next,
          nextTitle,
          nextSlug,
          envelope: {
            documentType: envelopeRaw.documentType,
            fields: { ...invariantFields, ...cultureFields },
            invariantFields,
            cultureFields,
            blocksBody: envelopeRaw.blocksBody,
          },
          parsedBody,
          snapshotBody,
        });
      } catch (err) {
        if (!active || runId !== detailRunIdRef.current) return;
        const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke hente side.";
        const m = message || "Kunne ikke hente side.";
        detailLoadRef.current?.applyLoadError(m);
        setDetailError(m);
        setPageNotFound(true);
      } finally {
        if (active && runId === detailRunIdRef.current) setDetailLoading(false);
      }
    }

    void loadPage();
    return () => {
      active = false;
    };
    // Mirror + last-loaded refs are stable object identities from the shell (tests must use useRef, not inline `{}`).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit refs to avoid spurious detail refetch
  }, [selectedId, refetchDetailKey, setPage, editorLocale]);

  const routeCbRef = useRef(routeUi?.onRoutePageIdChange);
  routeCbRef.current = routeUi?.onRoutePageIdChange;

  useEffect(() => {
    routeCbRef.current?.();
  }, [selectedId]);

  const focusAppliedRef = useRef(false);
  useEffect(() => {
    focusAppliedRef.current = false;
  }, [selectedId, routeUi?.initialFocusBlockId]);

  useEffect(() => {
    const fid = safeStr(routeUi?.initialFocusBlockId ?? "");
    const blocks = routeUi?.blocks ?? [];
    if (!fid || focusAppliedRef.current) return;
    if (!blocks.some((b) => b.id === fid)) return;
    focusAppliedRef.current = true;
    routeUi?.setSelectedBlockId(fid);
    const t = window.setTimeout(() => {
      document.getElementById(`lp-editor-block-${fid}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [
    routeUi?.blocks,
    routeUi?.initialFocusBlockId,
    selectedId,
    routeUi?.setSelectedBlockId,
  ]);

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
    guardPush,
    selectContentPage,
    reloadDetailFromServer,
  };
}

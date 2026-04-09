/**
 * Save / status / publish orchestration for ContentWorkspace.
 * Owns PATCH sequencing, conflict/offline classification, and editor sync after draft save.
 * Transport primitives stay in `contentWorkspace.persistence.ts`; API envelope in `contentWorkspace.api.ts`.
 */

"use client";

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  parseBodyToBlocks,
  snapshotBodyFromPageBody,
  type BodyParseResult,
} from "./contentWorkspace.blocks";
import { makeSnapshot, normalizeSlug, safeStr } from "./contentWorkspace.helpers";
import { parseJsonSafe, readApiError } from "./contentWorkspace.api";
import { buildDraftSavePayload, fetchPatchContentPage, isNetworkError } from "./contentWorkspace.persistence";
import { buildStatusTransitionPayload } from "./contentWorkspace.intent";
import {
  clearOutbox,
  fingerprintOutboxDraft,
  readOutbox,
  type OutboxDraft,
  type OutboxEntry,
} from "./contentWorkspace.outbox";
import type { ContentPage, PageData } from "./ContentWorkspaceState";
import type { SaveState } from "./types";
import type { PageStatus } from "./contentTypes";
import { parseBodyEnvelope } from "./_stubs";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { normalizeEditorFieldLayers } from "@/lib/cms/contentNodeEnvelope";
import { validateBlockCountForDataType } from "@/lib/cms/blocks/blockEditorDataTypes";

export type ContentWorkspacePersistenceRefs = {
  saveSeqRef: MutableRefObject<number>;
  activeAbortRef: MutableRefObject<AbortController | null>;
  pendingSaveRef: MutableRefObject<boolean>;
  performSaveRef: MutableRefObject<() => Promise<boolean>>;
  statusSeqRef: MutableRefObject<number>;
  statusAbortRef: MutableRefObject<AbortController | null>;
  statusInProgressRef: MutableRefObject<boolean>;
  savingRef: MutableRefObject<boolean>;
};

export type ContentWorkspacePersistenceParams = {
  effectiveId: string | undefined;
  selectedId: string;
  page: ContentPage | null;
  pageNotFound: boolean;
  detailError: string | null;
  isOffline: boolean;
  isDemo: boolean;
  title: string;
  slug: string;
  bodyForSave: unknown;
  lastServerUpdatedAt: string | null;
  saveState: SaveState;
  dirty: boolean;
  refs: ContentWorkspacePersistenceRefs;
  setPage: Dispatch<SetStateAction<ContentPage | null>>;
  setTitle: (v: string) => void;
  setSlug: (v: string) => void;
  setSlugTouched: (v: boolean) => void;
  applyParsedBody: (parsed: BodyParseResult) => void;
  setSavedSnapshot: (v: string | null) => void;
  setLastSavedAt: Dispatch<SetStateAction<string | null>>;
  setLastError: (v: string | null) => void;
  setLastServerUpdatedAt: (v: string | null) => void;
  setSaveStateSafe: (next: SaveState) => void;
  setOutboxData: Dispatch<SetStateAction<OutboxEntry | null>>;
  setIsStatusInProgress: (v: boolean) => void;
  updateSidebarItem: (next: ContentPage) => void;
  clearAutosaveTimer: () => void;
  router: { replace: (href: string) => void };
  pushToast: (t: { kind: "success" | "error" | "warning" | "default"; message: string; durationMs?: number }) => void;
  /** U94 — envelope document type for block data type limits */
  documentTypeAlias: string | null;
  blockCountForSave: number;
  /** U95 — admin-merged data types (null = baseline i validator) */
  mergedBlockEditorDataTypes: Record<string, BlockEditorDataTypeDefinition> | null;
  /** U96 — admin-merged document types (property → data type) */
  mergedDocumentTypeDefinitions: Record<string, DocumentTypeDefinition> | null;
  /** U98 */
  editorLocale: string;
  setInvariantEnvelopeFields: Dispatch<SetStateAction<Record<string, unknown>>>;
  setCultureEnvelopeFields: Dispatch<SetStateAction<Record<string, unknown>>>;
};

export type ContentWorkspacePersistenceApi = {
  patchPage: (
    partial: Record<string, unknown>,
    fallbackMessage: string,
    options?: { syncEditor?: boolean; signal?: AbortSignal }
  ) => Promise<ContentPage>;
  performSave: () => Promise<boolean>;
  saveDraft: (source?: "manual" | "autosave" | "shortcut") => Promise<boolean>;
  onSetStatus: (nextStatus: PageStatus) => Promise<void>;
};

export function useContentWorkspacePersistence(params: ContentWorkspacePersistenceParams): ContentWorkspacePersistenceApi {
  const {
    effectiveId,
    selectedId,
    page,
    pageNotFound,
    detailError,
    isOffline,
    isDemo,
    title,
    slug,
    bodyForSave,
    lastServerUpdatedAt,
    saveState,
    dirty,
    refs,
    setPage,
    setTitle,
    setSlug,
    setSlugTouched,
    applyParsedBody,
    setSavedSnapshot,
    setLastSavedAt,
    setLastError,
    setLastServerUpdatedAt,
    setSaveStateSafe,
    setOutboxData,
    setIsStatusInProgress,
    updateSidebarItem,
    clearAutosaveTimer,
    router,
    pushToast,
    documentTypeAlias,
    blockCountForSave,
    mergedBlockEditorDataTypes,
    mergedDocumentTypeDefinitions,
    editorLocale,
    setInvariantEnvelopeFields,
    setCultureEnvelopeFields,
  } = params;

  const {
    saveSeqRef,
    activeAbortRef,
    pendingSaveRef,
    performSaveRef,
    statusSeqRef,
    statusAbortRef,
    statusInProgressRef,
    savingRef,
  } = refs;

  const patchPage = useCallback(
    async (
      partial: Record<string, unknown>,
      fallbackMessage: string,
      options?: { syncEditor?: boolean; signal?: AbortSignal }
    ): Promise<ContentPage> => {
      if (!effectiveId) throw new Error("Mangler side-id.");

      const res = await fetchPatchContentPage(effectiveId, partial, {
        signal: options?.signal,
        editorLocale,
      });

      const payload = await parseJsonSafe<PageData>(res);

      if (!res.ok || !payload || payload.ok !== true) {
        const message = readApiError(res.status, payload, fallbackMessage);
        if (res.status === 409) {
          const e = new Error(message) as Error & { status: number };
          e.status = 409;
          throw e;
        }
        throw new Error(message);
      }

      const next = payload.data.page;

      if (options?.signal) {
        return next;
      }

      setPage((prev) => {
        if (!prev) return next;
        return { ...prev, ...next };
      });

      if (options?.syncEditor === true) {
        const nextTitle = safeStr(next.title);
        const nextSlug = safeStr(next.slug);
        const envelope = parseBodyEnvelope(next.body);
        const parsedBody = parseBodyToBlocks(envelope.blocksBody);
        const snapshotBody = snapshotBodyFromPageBody(next.body);
        const docAlias = envelope.documentType != null ? String(envelope.documentType).trim() : "";
        const doc =
          docAlias && mergedDocumentTypeDefinitions?.[docAlias]
            ? mergedDocumentTypeDefinitions[docAlias]!
            : null;
        const layers = normalizeEditorFieldLayers(next.body, doc);
        setInvariantEnvelopeFields(layers.invariantFields);
        setCultureEnvelopeFields(layers.cultureFields);

        setTitle(nextTitle);
        setSlug(nextSlug);
        setSlugTouched(false);
        applyParsedBody(parsedBody);

        setSavedSnapshot(
          makeSnapshot({
            title: nextTitle,
            slug: nextSlug,
            body: snapshotBody,
          })
        );
      }

      updateSidebarItem(next);
      setLastSavedAt(next.updated_at ?? new Date().toISOString());
      setLastError(null);

      if (options?.syncEditor === true && next.id && next.id !== selectedId) {
        router.replace(`/backoffice/content/${next.id}`);
      }

      return next;
    },
    [
      effectiveId,
      selectedId,
      applyParsedBody,
      updateSidebarItem,
      router,
      setPage,
      setTitle,
      setSlug,
      setSlugTouched,
      setSavedSnapshot,
      setLastSavedAt,
      setLastError,
      editorLocale,
      mergedDocumentTypeDefinitions,
      setInvariantEnvelopeFields,
      setCultureEnvelopeFields,
    ]
  );

  const performSave = useCallback(async (): Promise<boolean> => {
    if (isDemo) {
      setLastSavedAt(new Date().toISOString());
      setLastError(null);
      setSaveStateSafe("saved");
      pushToast({ kind: "success", message: "Lagret (demo).", durationMs: 2600 });
      return true;
    }
    if (!selectedId || !page) return false;
    if (pageNotFound || detailError) return false;
    if (isOffline) {
      setSaveStateSafe("offline");
      setLastError(null);
      return false;
    }

    const nextTitle = safeStr(title);
    const nextSlug = normalizeSlug(slug);
    if (!nextTitle || !nextSlug) {
      setLastError("Tittel og slug er påkrevd.");
      setSaveStateSafe("error");
      return false;
    }

    const limitMsg = validateBlockCountForDataType(
      documentTypeAlias,
      blockCountForSave,
      mergedBlockEditorDataTypes,
      mergedDocumentTypeDefinitions,
    );
    if (limitMsg) {
      setLastError(limitMsg);
      setSaveStateSafe("error");
      pushToast({ kind: "error", message: limitMsg, durationMs: 5200 });
      return false;
    }

    if (saveState === "saving") {
      pendingSaveRef.current = true;
      return false;
    }

    clearAutosaveTimer();
    setSaveStateSafe("saving");
    setLastError(null);

    saveSeqRef.current += 1;
    const seq = saveSeqRef.current;
    if (activeAbortRef.current) {
      activeAbortRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortRef.current = controller;

    const body = buildDraftSavePayload({
      title: nextTitle,
      slug: nextSlug,
      bodyForSave,
      lastServerUpdatedAt,
      envelopeMeta:
        documentTypeAlias && documentTypeAlias.trim() !== ""
          ? { editorLocale, pageStatus: page.status }
          : undefined,
    });

    try {
      const next = await patchPage(body, "Kunne ikke lagre side.", {
        syncEditor: true,
        signal: controller.signal,
      });
      if (seq !== saveSeqRef.current) return false;

      if (seq === saveSeqRef.current) {
        setPage((prev) => (prev ? { ...prev, ...next } : next));
        const nextTitleFromRes = safeStr(next.title);
        const nextSlugFromRes = safeStr(next.slug);
        const envelope = parseBodyEnvelope(next.body);
        const parsedBody = parseBodyToBlocks(envelope.blocksBody);
        const snapshotBody = snapshotBodyFromPageBody(next.body);
        const docAlias = envelope.documentType != null ? String(envelope.documentType).trim() : "";
        const doc =
          docAlias && mergedDocumentTypeDefinitions?.[docAlias]
            ? mergedDocumentTypeDefinitions[docAlias]!
            : null;
        const layers = normalizeEditorFieldLayers(next.body, doc);
        setInvariantEnvelopeFields(layers.invariantFields);
        setCultureEnvelopeFields(layers.cultureFields);
        setTitle(nextTitleFromRes);
        setSlug(nextSlugFromRes);
        setSlugTouched(false);
        applyParsedBody(parsedBody);
        setSavedSnapshot(makeSnapshot({ title: nextTitleFromRes, slug: nextSlugFromRes, body: snapshotBody }));
        updateSidebarItem(next);
        setLastSavedAt(next.updated_at ?? new Date().toISOString());
        setLastError(null);
        setLastServerUpdatedAt(next.updated_at ?? null);
        setSaveStateSafe("saved");
        pushToast({ kind: "success", message: "Endringer er lagret.", durationMs: 2800 });

        if (next.id && next.id !== selectedId) {
          router.replace(`/backoffice/content/${next.id}`);
        }

        const savedDraft: OutboxDraft = {
          title: nextTitle,
          slug: nextSlug,
          status: next.status,
          body: bodyForSave as string,
        };
        const savedFingerprint = fingerprintOutboxDraft(savedDraft);
        if (effectiveId) {
          const stored = readOutbox(effectiveId);
          if (stored && stored.fingerprint === savedFingerprint) {
            clearOutbox(effectiveId);
            setOutboxData(null);
          }
        }
        if (pendingSaveRef.current) {
          pendingSaveRef.current = false;
          setTimeout(() => void performSaveRef.current(), 0);
        }
      }
      return true;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return false;
      }
      const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke lagre side.";
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        if (seq !== saveSeqRef.current) return false;
        clearAutosaveTimer();
        setSaveStateSafe("conflict");
        setLastError(message);
      } else if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSaveStateSafe("offline");
        setLastError(message);
      } else if (isNetworkError(err)) {
        setSaveStateSafe("offline");
        setLastError(message);
      } else {
        setSaveStateSafe("error");
        setLastError(message);
      }
      return false;
    }
  }, [
    selectedId,
    page,
    pageNotFound,
    detailError,
    title,
    slug,
    bodyForSave,
    lastServerUpdatedAt,
    saveState,
    clearAutosaveTimer,
    patchPage,
    applyParsedBody,
    updateSidebarItem,
    router,
    effectiveId,
    isOffline,
    isDemo,
    pushToast,
    setPage,
    setTitle,
    setSlug,
    setSlugTouched,
    setSavedSnapshot,
    setLastSavedAt,
    setLastError,
    setLastServerUpdatedAt,
    setSaveStateSafe,
    setOutboxData,
    pendingSaveRef,
    saveSeqRef,
    activeAbortRef,
    performSaveRef,
    documentTypeAlias,
    blockCountForSave,
    mergedBlockEditorDataTypes,
    mergedDocumentTypeDefinitions,
    editorLocale,
    setInvariantEnvelopeFields,
    setCultureEnvelopeFields,
  ]);

  const saveDraft = useCallback(async (source: "manual" | "autosave" | "shortcut" = "manual"): Promise<boolean> => {
    void source;
    return performSave();
  }, [performSave]);

  const onSetStatus = useCallback(
    async (nextStatus: PageStatus) => {
      if (!selectedId || !page || pageNotFound || detailError || savingRef.current || statusInProgressRef.current)
        return;

      statusInProgressRef.current = true;
      setIsStatusInProgress(true);
      setLastError(null);
      clearAutosaveTimer();

      statusSeqRef.current += 1;
      const seq = statusSeqRef.current;
      if (statusAbortRef.current) {
        statusAbortRef.current.abort();
      }
      const controller = new AbortController();
      statusAbortRef.current = controller;

      try {
        const next = await patchPage(
          buildStatusTransitionPayload(nextStatus),
          "Kunne ikke oppdatere status.",
          { syncEditor: false, signal: controller.signal }
        );
        if (seq !== statusSeqRef.current) {
          statusInProgressRef.current = false;
          setIsStatusInProgress(false);
          return;
        }

        const merged = page ? { ...page, status: next.status, updated_at: next.updated_at, published_at: next.published_at } : next;
        setPage(merged);
        updateSidebarItem(merged);
        setLastServerUpdatedAt(next.updated_at ?? null);
        setLastSavedAt(next.updated_at ?? new Date().toISOString());
        setLastError(null);
        setSaveStateSafe(dirty ? "dirty" : "idle");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          statusInProgressRef.current = false;
          setIsStatusInProgress(false);
          return;
        }
        const status = (err as { status?: number })?.status;
        const message = err instanceof Error ? safeStr(err.message) : "Kunne ikke oppdatere status.";
        if (status === 409) {
          if (seq !== statusSeqRef.current) return;
          clearAutosaveTimer();
          setSaveStateSafe("conflict");
          setLastError(message || "Kunne ikke oppdatere status.");
        } else {
          setLastError(message || "Kunne ikke oppdatere status.");
          setSaveStateSafe("error");
        }
      } finally {
        statusInProgressRef.current = false;
        setIsStatusInProgress(false);
      }
    },
    [
      selectedId,
      dirty,
      page,
      pageNotFound,
      detailError,
      clearAutosaveTimer,
      patchPage,
      updateSidebarItem,
      setPage,
      setLastServerUpdatedAt,
      setLastSavedAt,
      setLastError,
      setSaveStateSafe,
      setIsStatusInProgress,
      savingRef,
      statusSeqRef,
      statusAbortRef,
      statusInProgressRef,
    ]
  );

  return { patchPage, performSave, saveDraft, onSetStatus };
}

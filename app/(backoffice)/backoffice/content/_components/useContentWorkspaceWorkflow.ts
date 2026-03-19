"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PageStatus } from "./contentTypes";
import type { SaveState } from "./types";
import type { ContentPage } from "./useContentWorkspacePageData";
import { useContentSaveStatus } from "./useContentSaveStatus";
import { safeStr } from "./contentWorkspace.helpers";

export type UseContentWorkspaceWorkflowDeps = {
  page: ContentPage | null;
  selectedId: string;
  saveState: SaveState;
  dirty: boolean;
  isOffline: boolean;
  detailLoading: boolean;
  pageNotFound: boolean;
  detailError: string | null;
  saving: boolean;
  lastSavedAt: string | null;
  lastError: string | null;
  formatDateFn: (v: string | null | undefined) => string;
  patchPage: (
    partial: Record<string, unknown>,
    fallbackMessage: string,
    options?: { syncEditor?: boolean; signal?: AbortSignal }
  ) => Promise<ContentPage>;
  setPage: (page: ContentPage) => void;
  updateSidebarItem: (next: ContentPage) => void;
  setLastServerUpdatedAt: (v: string | null) => void;
  setLastSavedAt: (v: string | null) => void;
  setLastError: (v: string | null) => void;
  setSaveStateSafe: (next: SaveState) => void;
};

export type UseContentWorkspaceWorkflowResult = ReturnType<typeof useContentWorkspaceWorkflow>;

export function nextWorkflowSaveState(
  currentSaveState: SaveState,
  dirty: boolean
): SaveState {
  // After a successful status change we either remain dirty (unsaved content)
  // or go back to idle when editor is clean.
  return dirty ? "dirty" : "idle";
}

export function useContentWorkspaceWorkflow(
  deps: UseContentWorkspaceWorkflowDeps
) {
  const {
    page,
    selectedId,
    saveState,
    dirty,
    isOffline,
    detailLoading,
    pageNotFound,
    detailError,
    saving,
    lastSavedAt,
    lastError,
    formatDateFn,
    patchPage,
    setPage,
    updateSidebarItem,
    setLastServerUpdatedAt,
    setLastSavedAt,
    setLastError,
    setSaveStateSafe,
  } = deps;

  const statusSeqRef = useRef<number>(0);
  const statusAbortRef = useRef<AbortController | null>(null);
  const statusInProgressRef = useRef(false);
  const [isStatusInProgress, setIsStatusInProgress] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (statusAbortRef.current) {
        statusAbortRef.current.abort();
      }
    };
  }, []);

  const saveStatus = useContentSaveStatus({
    saveState,
    dirty,
    isOffline,
    lastSavedAt,
    lastError,
    formatDateFn,
    page,
    selectedId,
    detailLoading,
    isStatusInProgress,
    hasConflict: saveState === "conflict",
  });

  const {
    statusLine,
    statusLabel,
    statusBadgeClass,
    canPublish,
    canUnpublish,
    publishDisabledTitle,
    unpublishDisabledTitle,
  } = saveStatus;

  const onSetStatus = useCallback(
    async (nextStatus: PageStatus) => {
      if (!selectedId || !page || pageNotFound || detailError || saving || statusInProgressRef.current) return;

      statusInProgressRef.current = true;
      setIsStatusInProgress(true);
      setLastError(null);

      statusSeqRef.current += 1;
      const seq = statusSeqRef.current;
      if (statusAbortRef.current) {
        statusAbortRef.current.abort();
      }
      const controller = new AbortController();
      statusAbortRef.current = controller;

      try {
        // Safe publish semantics:
        // 1) copy preview variant body -> prod variant (variant/publish)
        // 2) only then flip status -> published (content_pages.status)
        if (nextStatus === "published") {
          const variantId = (page as any)?.variantId ?? null;
          if (!variantId || typeof variantId !== "string") {
            setLastError("Mangler preview-variant for publisering.");
            setSaveStateSafe("error");
            return;
          }

          const res = await fetch(
            `/api/backoffice/content/pages/${encodeURIComponent(selectedId)}/variant/publish`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ variantId, env: "prod", locale: "nb" }),
              signal: controller.signal,
            }
          );

          if (!res.ok) {
            const payload = (await res.json().catch(() => null)) as
              | { message?: string; status?: number }
              | null;
            const msg = safeStr(payload?.message ?? `Kunne ikke publisere siden (${res.status}).`);
            const e = new Error(msg) as Error & { status?: number };
            e.status = payload?.status ?? res.status;
            throw e;
          }

          // If a newer status change was requested while publishing, abort applying status.
          if (seq !== statusSeqRef.current) return;
        }

        const next = await patchPage(
          { status: nextStatus, environment: "preview" },
          "Kunne ikke oppdatere status.",
          { syncEditor: false, signal: controller.signal }
        );
        if (seq !== statusSeqRef.current) {
          statusInProgressRef.current = false;
          setIsStatusInProgress(false);
          return;
        }

        const merged: ContentPage = page
          ? { ...page, status: next.status, updated_at: next.updated_at, published_at: next.published_at }
          : next;
        setPage(merged);
        updateSidebarItem(merged);
        setLastServerUpdatedAt(next.updated_at ?? null);
        setLastSavedAt(next.updated_at ?? new Date().toISOString());
        setLastError(null);
        setSaveStateSafe(nextWorkflowSaveState(saveState, dirty));
        setStatusFeedback(nextStatus === "published" ? "Publisert" : "Satt til kladd");
        setTimeout(() => setStatusFeedback(null), 2000);
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
      saving,
      patchPage,
      updateSidebarItem,
      setLastServerUpdatedAt,
      setLastSavedAt,
      setLastError,
      setSaveStateSafe,
      saveState,
      setPage,
    ]
  );

  return {
    statusLine,
    statusLabel,
    statusBadgeClass,
    canPublish,
    canUnpublish,
    publishDisabledTitle,
    unpublishDisabledTitle,
    isStatusInProgress,
    statusFeedback,
    onSetStatus,
  };
}


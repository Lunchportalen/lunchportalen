"use client";

import { useMemo } from "react";
import type { PageStatus } from "./contentTypes";
import type { SaveState, StatusLineState } from "./types";

function getStatusLineState(params: {
  saveState: SaveState;
  dirty: boolean;
  isOffline: boolean;
  lastSavedAt: string | null;
  lastError: string | null;
  formatDateFn: (v: string | null | undefined) => string;
  hasSelection: boolean;
  hasPage: boolean;
  detailLoading: boolean;
}): StatusLineState {
  const {
    saveState,
    dirty,
    isOffline,
    lastSavedAt,
    lastError,
    formatDateFn,
    hasSelection,
    hasPage,
    detailLoading,
  } = params;

  // No page selected or detail still loading: never claim "Lagret".
  if (!hasSelection || !hasPage || detailLoading) {
    return {
      key: "idle",
      tone: "border-slate-300 bg-slate-50 text-slate-700",
      label: detailLoading ? "Laster …" : "Ingen side valgt",
      actions: {},
    };
  }
  if (saveState === "conflict")
    return {
      key: "conflict",
      tone: "border-amber-300 bg-amber-50 text-amber-800",
      label: "Konflikt",
      detail: "Last på nytt for å hente nyeste versjon.",
      actions: { reload: true },
    };
  if (saveState === "offline" || isOffline)
    return {
      key: "offline",
      tone: "border-slate-300 bg-slate-50 text-slate-700",
      label: "Offline – lagres lokalt",
      actions: {},
    };
  if (saveState === "error")
    return {
      key: "error",
      tone: "border-amber-300 bg-amber-50 text-amber-800",
      label: "Lagring feilet",
      detail:
        lastError && lastError.trim() ? lastError.trim().slice(0, 120) : "Prøv å lagre på nytt.",
      actions: { retry: true },
    };
  if (saveState === "saving")
    return {
      key: "saving",
      tone: "border-slate-300 bg-slate-50 text-slate-700",
      label: "Lagrer…",
      actions: {},
    };
  if (dirty || saveState === "dirty")
    return {
      key: "unsaved",
      tone: "border-amber-200 bg-amber-50/80 text-amber-800",
      label: "Ulagrede endringer",
      actions: {},
    };
  return {
    key: "saved",
    tone: "border-green-200 bg-green-50/80 text-green-800",
    label: "Lagret",
    detail: lastSavedAt ? `Sist lagret ${formatDateFn(lastSavedAt)}` : undefined,
    actions: {},
  };
}

export function statusTone(status: PageStatus): string {
  return status === "published"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-900";
}

export type UseContentSaveStatusParams = {
  saveState: SaveState;
  dirty: boolean;
  isOffline: boolean;
  lastSavedAt: string | null;
  lastError: string | null;
  formatDateFn: (v: string | null | undefined) => string;
  page: { status: PageStatus } | null;
  selectedId: string | null;
  detailLoading: boolean;
  isStatusInProgress: boolean;
  hasConflict: boolean;
};

export type UseContentSaveStatusResult = {
  statusLine: StatusLineState;
  statusLabel: PageStatus;
  statusBadgeClass: string;
  canPublish: boolean;
  canUnpublish: boolean;
  publishDisabledTitle: string | undefined;
  unpublishDisabledTitle: string | undefined;
};

export function useContentSaveStatus(
  params: UseContentSaveStatusParams,
): UseContentSaveStatusResult {
  const {
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
    hasConflict,
  } = params;

  const statusLabel: PageStatus = useMemo(() => (page ? page.status : "draft"), [page]);
  const isPublished = statusLabel === "published";
  const isDraft = statusLabel === "draft";
  const saving = saveState === "saving";

  const canPublish = Boolean(
    selectedId &&
      page &&
      !isPublished &&
      !dirty &&
      !saving &&
      !detailLoading &&
      !isStatusInProgress &&
      !hasConflict &&
      !isOffline,
  );
  const canUnpublish = Boolean(
    selectedId &&
      page &&
      !isDraft &&
      !saving &&
      !detailLoading &&
      !isStatusInProgress &&
      !hasConflict &&
      !isOffline,
  );

  const publishDisabledTitle =
    !canPublish && dirty
      ? "Lagre først før du publiserer"
      : !canPublish && (!selectedId || !page)
        ? "Velg en side først"
        : !canPublish && hasConflict
          ? "Konflikt – last på nytt"
          : !canPublish && isOffline
            ? "Offline – kan ikke publisere"
            : !canPublish && (saving || isStatusInProgress)
              ? "Venter på lagring…"
              : !canPublish && detailLoading
                ? "Laster detaljer…"
                : undefined;
  const unpublishDisabledTitle =
    !canUnpublish && (!selectedId || !page)
      ? "Velg en side først"
      : !canUnpublish && hasConflict
        ? "Konflikt – last på nytt"
        : !canUnpublish && isOffline
          ? "Offline – kan ikke publisere"
          : !canUnpublish && (saving || isStatusInProgress)
            ? "Venter på lagring…"
            : !canUnpublish && detailLoading
              ? "Laster detaljer…"
              : undefined;

  const hasSelection = Boolean(selectedId);
  const hasPage = Boolean(page);

  const statusLine = useMemo(
    () =>
      getStatusLineState({
        saveState,
        dirty,
        isOffline,
        lastSavedAt,
        lastError,
        formatDateFn,
        hasSelection,
        hasPage,
        detailLoading,
      }),
    [
      saveState,
      dirty,
      isOffline,
      lastSavedAt,
      lastError,
      formatDateFn,
      hasSelection,
      hasPage,
      detailLoading,
    ],
  );

  return {
    statusLine,
    statusLabel,
    statusBadgeClass: statusTone(statusLabel),
    canPublish,
    canUnpublish,
    publishDisabledTitle,
    unpublishDisabledTitle,
  };
}


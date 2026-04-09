/**
 * Chrome-/top-bar view-model for ContentWorkspace: status, publish-rail, historikk-preview-blokker.
 * Ren flytting av eksisterende useMemo/utledning — ingen ny forretningslogikk.
 */

"use client";

import { useCallback, useMemo, type MutableRefObject } from "react";
import type { Block } from "./editorBlockTypes";
import { validateModel, type BlockList, type BlockNode } from "./_stubs";
import type { HistoryPreviewPayload } from "./ContentPageVersionHistory";
import type { PageStatus } from "./contentWorkspace.types";
import { normalizeBlocks, parseBodyToBlocks } from "./contentWorkspace.blocks";
import {
  formatDate,
  getStatusLineState,
  normalizeSlug,
} from "./contentWorkspacePresentationSelectors";
import type { SaveState, StatusLineState, SupportSnapshot } from "./types";
import type { ContentPage } from "./ContentWorkspaceState";
import { makeRidClient } from "./contentWorkspace.helpers";

export type EditorChromePublishRailStateArgs = {
  page: ContentPage | null;
  slug: string;
  saveState: SaveState;
  dirty: boolean;
  isOffline: boolean;
  lastSavedAt: string | null;
  lastError: string | null;
  isDemo: boolean;
  selectedId: string;
  detailLoading: boolean;
  isStatusInProgress: boolean;
  title: string;
  blocks: Block[];
};

export function useEditorChromePublishRailState(
  p: EditorChromePublishRailStateArgs,
): {
  statusLabel: PageStatus;
  isPublished: boolean;
  isDraft: boolean;
  saving: boolean;
  hasConflict: boolean;
  canSave: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  publicSlug: string | null;
  canOpenPublic: boolean;
  publishDisabledTitle: string | undefined;
  unpublishDisabledTitle: string | undefined;
  statusLine: StatusLineState;
  publishReadiness: boolean;
} {
  const statusLabel = useMemo<PageStatus>(() => {
    if (!p.page) return "draft";
    return p.page.status;
  }, [p.page]);

  const isPublished = statusLabel === "published";
  const isDraft = statusLabel === "draft";

  const saving = p.saveState === "saving";
  const hasConflict = p.saveState === "conflict";
  const canSave = Boolean(
    !p.isDemo && p.selectedId && p.page && p.dirty && !saving && !p.detailLoading && !hasConflict && !p.isOffline,
  );
  const canPublish = Boolean(
    !p.isDemo &&
      p.selectedId &&
      p.page &&
      !isPublished &&
      !saving &&
      !p.detailLoading &&
      !p.isStatusInProgress &&
      !hasConflict &&
      !p.isOffline,
  );
  const canUnpublish = Boolean(
    !p.isDemo &&
      p.selectedId &&
      p.page &&
      !isDraft &&
      !saving &&
      !p.detailLoading &&
      !p.isStatusInProgress &&
      !hasConflict &&
      !p.isOffline,
  );

  const publicSlug = useMemo(() => {
    const raw = p.slug || p.page?.slug || "";
    const norm = normalizeSlug(raw);
    return norm || null;
  }, [p.slug, p.page?.slug]);

  const canOpenPublic = Boolean(publicSlug);

  const publishDisabledTitle =
    !canPublish && (!p.selectedId || !p.page)
      ? "Velg en side først"
      : !canPublish && hasConflict
        ? "Konflikt – last på nytt"
        : !canPublish && p.isOffline
          ? "Offline – kan ikke publisere"
          : !canPublish && (saving || p.isStatusInProgress)
            ? "Venter på lagring…"
            : !canPublish && p.detailLoading
              ? "Laster detaljer…"
              : undefined;
  const unpublishDisabledTitle =
    !canUnpublish && (!p.selectedId || !p.page)
      ? "Velg en side først"
      : !canUnpublish && hasConflict
        ? "Konflikt – last på nytt"
        : !canUnpublish && p.isOffline
          ? "Offline – kan ikke publisere"
          : !canUnpublish && (saving || p.isStatusInProgress)
            ? "Venter på lagring…"
            : !canUnpublish && p.detailLoading
              ? "Laster detaljer…"
              : undefined;

  const statusLine: StatusLineState = useMemo(
    () =>
      getStatusLineState({
        saveState: p.saveState,
        dirty: p.dirty,
        isOffline: p.isOffline,
        lastSavedAt: p.lastSavedAt,
        lastError: p.lastError,
        formatDateFn: formatDate,
      }),
    [p.saveState, p.dirty, p.isOffline, p.lastSavedAt, p.lastError],
  );

  const publishReadiness = Boolean(p.title.trim().length > 0 && p.blocks.length >= 1);

  return {
    statusLabel,
    isPublished,
    isDraft,
    saving,
    hasConflict,
    canSave,
    canPublish,
    canUnpublish,
    publicSlug,
    canOpenPublic,
    publishDisabledTitle,
    unpublishDisabledTitle,
    statusLine,
    publishReadiness,
  };
}

export function useHistoryPreviewBlocksForChromeShell(
  historyVersionPreview: HistoryPreviewPayload | null,
): Block[] | null {
  return useMemo((): Block[] | null => {
    if (!historyVersionPreview) return null;
    const parsed = parseBodyToBlocks(historyVersionPreview.body);
    return normalizeBlocks(parsed.blocks);
  }, [historyVersionPreview]);
}

/** I4 – support snapshot (kun ved conflict/offline/error) + kopier til utklippstavle. */
export function useChromeShellSupportSnapshot(
  statusLineKey: StatusLineState["key"],
  selectedId: string,
  pageSlug: string | undefined,
  isOffline: boolean,
  sessionRidRef: MutableRefObject<string | null>,
): SupportSnapshot | null {
  return useMemo(() => {
    if (statusLineKey !== "conflict" && statusLineKey !== "offline" && statusLineKey !== "error") return null;
    if (!sessionRidRef.current) sessionRidRef.current = makeRidClient();
    return {
      rid: sessionRidRef.current,
      pageId: selectedId ?? null,
      slug: pageSlug ?? undefined,
      saveStateKey: statusLineKey,
      isOnline: !isOffline,
      ts: new Date().toISOString(),
    };
  }, [statusLineKey, selectedId, pageSlug, isOffline, sessionRidRef]);
}

/** Editor 2.0 – validering av blokker (read-only adapter). */
export function useEditor2ValidationFromModel(editor2Model: BlockList | null): {
  byId: Record<string, string[]>;
  total: number;
  firstId: string | null;
} {
  return useMemo(() => {
    if (!editor2Model?.blocks?.length)
      return { byId: {} as Record<string, string[]>, total: 0, firstId: null as string | null };
    return validateModel(editor2Model.blocks.map((b: BlockNode) => ({ id: b.id, type: b.type, data: b.data ?? {} })));
  }, [editor2Model]);
}

export function useChromeShellCopySupportSnapshot(
  supportSnapshot: SupportSnapshot | null,
  setSupportCopyFeedback: (v: "ok" | "fail" | null) => void,
): () => Promise<void> {
  return useCallback(
    async () => {
      if (!supportSnapshot) return;
      setSupportCopyFeedback(null);
      const str = JSON.stringify(supportSnapshot, null, 2);
      try {
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(str);
          setSupportCopyFeedback("ok");
        } else {
          throw new Error("clipboard_unavailable");
        }
      } catch {
        try {
          const textarea = document.createElement("textarea");
          textarea.value = str;
          textarea.setAttribute("readonly", "");
          textarea.style.position = "fixed";
          textarea.style.left = "-9999px";
          document.body.appendChild(textarea);
          textarea.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(textarea);
          setSupportCopyFeedback(ok ? "ok" : "fail");
        } catch {
          setSupportCopyFeedback("fail");
        }
      }
    },
    [supportSnapshot, setSupportCopyFeedback],
  );
}

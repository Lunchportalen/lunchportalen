"use client";

import { useEffect, useMemo } from "react";
import { useBellissimaEntityWorkspacePublisher } from "@/components/backoffice/ContentBellissimaWorkspaceContext";
import {
  buildContentBellissimaWorkspaceSnapshot,
  type ContentBellissimaActionHandlerMap,
  type ContentBellissimaWorkspaceSnapshot,
} from "@/lib/cms/backofficeWorkspaceContextModel";
import type { BackofficeContentEntityWorkspaceViewId } from "@/lib/cms/backofficeExtensionRegistry";
import { useContentAuditLogHealth } from "./useContentAuditLogHealth";
import type { ContentPage } from "./ContentWorkspaceState";

type UseContentWorkspaceBellissimaParams = {
  effectiveId: string | null;
  page: ContentPage | null;
  pageNotFound: boolean;
  detailError: string | null;
  detailLoading: boolean;
  title: string;
  slug: string;
  documentTypeAlias: string | null;
  statusLabel: "draft" | "published";
  canvasMode: "edit" | "preview";
  saveState: string;
  dirty: boolean;
  canSave: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canOpenPublic: boolean;
  activeWorkspaceView: BackofficeContentEntityWorkspaceViewId;
  actionHandlers: ContentBellissimaActionHandlerMap;
};

export function useContentWorkspaceBellissima({
  effectiveId,
  page,
  pageNotFound,
  detailError,
  detailLoading,
  title,
  slug,
  documentTypeAlias,
  statusLabel,
  canvasMode,
  saveState,
  dirty,
  canSave,
  canPublish,
  canUnpublish,
  canOpenPublic,
  activeWorkspaceView,
  actionHandlers,
}: UseContentWorkspaceBellissimaParams) {
  const publishBellissima = useBellissimaEntityWorkspacePublisher();
  const auditLogDegraded = useContentAuditLogHealth(
    Boolean(page && !pageNotFound && !detailError && !detailLoading && effectiveId),
  );

  const bellissimaSnapshot = useMemo(
    () =>
      page && !pageNotFound && !detailError && !detailLoading
        ? buildContentBellissimaWorkspaceSnapshot({
            pageId: effectiveId,
            title,
            slug,
            subtitle: documentTypeAlias
              ? `Document type ${documentTypeAlias} redigeres i én delt workspace-host med tree, preview og inspector.`
              : "Redigering, preview og inspector deler samme workspace-host og kontekst.",
            documentTypeAlias,
            statusLabel,
            canvasMode,
            saveState,
            dirty,
            canSave,
            canPublish,
            canUnpublish,
            canPreview: true,
            canOpenPublic,
            auditLogDegraded,
            activeWorkspaceView,
          })
        : null,
    [
      page,
      pageNotFound,
      detailError,
      detailLoading,
      effectiveId,
      title,
      slug,
      documentTypeAlias,
      statusLabel,
      canvasMode,
      saveState,
      dirty,
      canSave,
      canPublish,
      canUnpublish,
      canOpenPublic,
      auditLogDegraded,
      activeWorkspaceView,
    ],
  );

  useEffect(() => {
    if (!bellissimaSnapshot) {
      publishBellissima(null);
      return;
    }
    publishBellissima(bellissimaSnapshot, {
      actionHandlers,
    });
    return () => {
      publishBellissima(null);
    };
  }, [actionHandlers, bellissimaSnapshot, publishBellissima]);

  return bellissimaSnapshot as ContentBellissimaWorkspaceSnapshot | null;
}

"use client";

/**
 * Upper editor chrome: command topbar, outbox recovery, title + canvas mode / preview device row.
 * Presentation only — props from parent shell.
 */

import { usePathname } from "next/navigation";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";
import { ContentTopbar } from "./ContentTopbar";
import { ContentWorkspaceOutboxRecoveryBanner } from "./ContentWorkspaceOutboxRecoveryBanner";
import { ContentWorkspaceEditorModeStrip } from "./ContentWorkspaceEditorModeStrip";
import { statusTone, type ContentWorkspaceHeaderChromeProps } from "./ContentWorkspaceEditorChrome.types";

export type { ContentWorkspaceHeaderChromeProps } from "./ContentWorkspaceEditorChrome.types";

export function ContentWorkspaceHeaderChrome(props: ContentWorkspaceHeaderChromeProps) {
  const {
    statusLabel,
    pageTitle,
    pageSlug,
    statusLine,
    supportSnapshot,
    supportCopyFeedback,
    canPublish,
    canUnpublish,
    selectedId,
    pageExists,
    isOffline,
    publishDisabledTitle,
    unpublishDisabledTitle,
    onCopySupportSnapshot,
    onRetrySave,
    onReload,
    onPublish,
    onUnpublish,
    recoveryBannerVisible,
    outboxData,
    hasFingerprintConflict,
    outboxDetailsExpanded,
    setOutboxDetailsExpanded,
    copyOutboxSafetyExport,
    outboxCopyFeedback,
    onRestoreOutbox,
    onDiscardOutbox,
    formatDate,
    mainView,
    setMainView,
    canvasMode,
    title,
    setTitle,
    setCanvasMode,
    previewDevice,
    setPreviewDevice,
    pageUpdatedAt,
    pageId,
    canOpenPublic,
    onOpenPublicPage,
    publishReadiness,
  } = props;

  const pathname = usePathname() ?? "";
  const isContentDetailEditor = resolveBackofficeContentRoute(pathname).kind === "detail";

  return (
    <div className={`min-w-0 w-full ${isContentDetailEditor ? "space-y-1" : "space-y-2"}`}>
      <ContentTopbar
        statusBadgeClass={statusTone(statusLabel)}
        statusLabel={statusLabel}
        title={pageTitle}
        slug={pageSlug}
        statusLine={statusLine}
        supportSnapshot={supportSnapshot}
        supportCopyFeedback={supportCopyFeedback}
        canPublish={canPublish}
        canUnpublish={canUnpublish}
        selectedId={selectedId}
        pageExists={pageExists}
        isOffline={isOffline}
        publishDisabledTitle={publishDisabledTitle}
        unpublishDisabledTitle={unpublishDisabledTitle}
        onCopySupportSnapshot={onCopySupportSnapshot}
        onRetrySave={onRetrySave}
        onReload={onReload}
        onPublish={onPublish}
        onUnpublish={onUnpublish}
      />
      <ContentWorkspaceOutboxRecoveryBanner
        recoveryBannerVisible={recoveryBannerVisible}
        outboxData={outboxData}
        hasFingerprintConflict={hasFingerprintConflict}
        outboxDetailsExpanded={outboxDetailsExpanded}
        setOutboxDetailsExpanded={setOutboxDetailsExpanded}
        copyOutboxSafetyExport={copyOutboxSafetyExport}
        outboxCopyFeedback={outboxCopyFeedback}
        onRestoreOutbox={onRestoreOutbox}
        onDiscardOutbox={onDiscardOutbox}
        formatDate={formatDate}
      />

      <ContentWorkspaceEditorModeStrip
        canvasMode={canvasMode}
        title={title}
        setTitle={setTitle}
        mainView={mainView}
        setMainView={setMainView}
        setCanvasMode={setCanvasMode}
        previewDevice={previewDevice}
        setPreviewDevice={setPreviewDevice}
        formatDate={formatDate}
        pageUpdatedAt={pageUpdatedAt}
        pageId={pageId}
        canOpenPublic={canOpenPublic}
        onOpenPublicPage={onOpenPublicPage}
        publishReadiness={publishReadiness}
      />
    </div>
  );
}

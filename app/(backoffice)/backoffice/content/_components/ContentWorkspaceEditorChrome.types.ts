import type { Dispatch, SetStateAction } from "react";
import type { PageStatus } from "./contentWorkspace.types";
import type { StatusLineState, SupportSnapshot } from "./types";
import type { OutboxEntry } from "./contentWorkspace.outbox";
import type { PreviewDeviceId } from "./PreviewCanvas";
import type { BackofficeContentEntityWorkspaceViewId } from "@/lib/cms/backofficeExtensionRegistry";

type MainView = BackofficeContentEntityWorkspaceViewId;

export function statusTone(status: PageStatus): string {
  return status === "published"
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-900";
}

/** Props for the upper editor chrome (topbar + outbox + mode strip). */
export type ContentWorkspaceHeaderChromeProps = {
  statusLabel: PageStatus;
  pageTitle: string;
  pageSlug: string;
  statusLine: StatusLineState;
  supportSnapshot: SupportSnapshot | null | undefined;
  supportCopyFeedback: "ok" | "fail" | null;
  canPublish: boolean;
  canUnpublish: boolean;
  selectedId: string;
  pageExists: boolean;
  isOffline: boolean;
  publishDisabledTitle?: string;
  unpublishDisabledTitle?: string;
  onCopySupportSnapshot: () => void;
  onRetrySave: () => void;
  onReload: () => void;
  onPublish: () => void | Promise<void>;
  onUnpublish: () => void;
  recoveryBannerVisible: boolean;
  outboxData: OutboxEntry | null;
  hasFingerprintConflict: boolean;
  outboxDetailsExpanded: boolean;
  setOutboxDetailsExpanded: Dispatch<SetStateAction<boolean>>;
  copyOutboxSafetyExport: (entry: OutboxEntry) => void;
  outboxCopyFeedback: Record<string, "ok" | "fail" | undefined>;
  onRestoreOutbox: () => void;
  onDiscardOutbox: () => void;
  formatDate: (v: string | null | undefined) => string;
  mainView: MainView;
  setMainView: (v: MainView) => void;
  canvasMode: "preview" | "edit";
  title: string;
  setTitle: (v: string) => void;
  setCanvasMode: (m: "preview" | "edit") => void;
  previewDevice: PreviewDeviceId;
  setPreviewDevice: (d: PreviewDeviceId) => void;
  pageUpdatedAt: string | null | undefined;
  pageId: string;
  canOpenPublic: boolean;
  onOpenPublicPage: () => void;
  publishReadiness: boolean;
};

export type ContentWorkspaceEditorChromeProps = ContentWorkspaceHeaderChromeProps;

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";

import {
  buildContentBellissimaWorkspaceSnapshot,
  buildContentBellissimaWorkspaceModel,
  type ContentBellissimaPreviewDeviceId,
  type ContentBellissimaPreviewLayoutMode,
  type ContentBellissimaInspectorSectionId,
  isBackofficeContentEntityWorkspaceViewId,
  type ContentBellissimaActionHandlerMap,
  type ContentBellissimaWorkspaceViewId,
  type ContentBellissimaWorkspaceModel,
  type ContentBellissimaWorkspaceSideAppId,
  type ContentBellissimaWorkspaceSnapshot,
} from "@/lib/cms/backofficeWorkspaceContextModel";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";

export type BellissimaWorkspacePublishOptions = {
  actionHandlers?: ContentBellissimaActionHandlerMap;
};

export type BellissimaWorkspacePublishScope = "section" | "entity";

type BellissimaWorkspacePublication = {
  snapshot: ContentBellissimaWorkspaceSnapshot | null;
  actionHandlers: ContentBellissimaActionHandlerMap;
};

const EMPTY_BELLISSIMA_WORKSPACE_PUBLICATION: BellissimaWorkspacePublication = {
  snapshot: null,
  actionHandlers: {},
};

export function resolveActiveBellissimaWorkspacePublication(
  section: BellissimaWorkspacePublication,
  entity: BellissimaWorkspacePublication,
): BellissimaWorkspacePublication {
  if (entity.snapshot) return entity;
  if (section.snapshot) return section;
  return EMPTY_BELLISSIMA_WORKSPACE_PUBLICATION;
}

type BellissimaCtx = {
  snapshot: ContentBellissimaWorkspaceSnapshot | null;
  model: ContentBellissimaWorkspaceModel | null;
  publish: (
    scope: BellissimaWorkspacePublishScope,
    s: ContentBellissimaWorkspaceSnapshot | null,
    options?: BellissimaWorkspacePublishOptions,
  ) => void;
  setActiveView: (view: ContentBellissimaWorkspaceViewId) => void;
  activeSideApp: ContentBellissimaWorkspaceSideAppId;
  setActiveSideApp: (app: ContentBellissimaWorkspaceSideAppId) => void;
  activeInspectorSection: ContentBellissimaInspectorSectionId;
  setActiveInspectorSection: (section: ContentBellissimaInspectorSectionId) => void;
  previewDevice: ContentBellissimaPreviewDeviceId;
  setPreviewDevice: Dispatch<SetStateAction<ContentBellissimaPreviewDeviceId>>;
  previewLayoutMode: ContentBellissimaPreviewLayoutMode;
  setPreviewLayoutMode: Dispatch<SetStateAction<ContentBellissimaPreviewLayoutMode>>;
  showPreviewColumn: boolean;
  setShowPreviewColumn: Dispatch<SetStateAction<boolean>>;
};

const Ctx = createContext<BellissimaCtx | null>(null);

export function ContentBellissimaWorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";
  const [sectionPublication, setSectionPublication] = useState<BellissimaWorkspacePublication>(
    EMPTY_BELLISSIMA_WORKSPACE_PUBLICATION,
  );
  const [entityPublication, setEntityPublication] = useState<BellissimaWorkspacePublication>(
    EMPTY_BELLISSIMA_WORKSPACE_PUBLICATION,
  );
  const [activeSideApp, setActiveSideAppState] =
    useState<ContentBellissimaWorkspaceSideAppId>("workspace");
  const [activeInspectorSection, setActiveInspectorSectionState] =
    useState<ContentBellissimaInspectorSectionId>("content");
  const [previewDevice, setPreviewDevice] =
    useState<ContentBellissimaPreviewDeviceId>("desktop");
  const [previewLayoutMode, setPreviewLayoutMode] =
    useState<ContentBellissimaPreviewLayoutMode>("split");
  const [showPreviewColumn, setShowPreviewColumn] = useState(true);
  const activePublication = useMemo(
    () =>
      resolveActiveBellissimaWorkspacePublication(sectionPublication, entityPublication),
    [entityPublication, sectionPublication],
  );
  const snapshot = activePublication.snapshot;
  const actionHandlers = activePublication.actionHandlers;
  const workspaceScopeKeyRef = useRef<string | null>(null);
  const workspaceScopeKey = snapshot
    ? `${snapshot.viewScope}:${snapshot.entityId ?? "section"}`
    : null;

  const publish = useCallback(
    (
      scope: BellissimaWorkspacePublishScope,
      next: ContentBellissimaWorkspaceSnapshot | null,
      options?: BellissimaWorkspacePublishOptions,
    ) => {
      const nextPublication: BellissimaWorkspacePublication = {
        snapshot: next,
        actionHandlers: options?.actionHandlers ?? {},
      };
      if (scope === "entity") {
        setEntityPublication(nextPublication);
        return;
      }
      setSectionPublication(nextPublication);
    },
    [],
  );

  const setActiveView = useCallback(
    (view: ContentBellissimaWorkspaceViewId) => {
      /** `/backoffice/content/[id]`: én dokumenteditor — design/global er ikke egne visninger. */
      let resolved: ContentBellissimaWorkspaceViewId = view;
      if (
        resolveBackofficeContentRoute(pathname).kind === "detail" &&
        isBackofficeContentEntityWorkspaceViewId(view) &&
        (view === "design" || view === "global")
      ) {
        resolved = "content";
      }
      setActiveSideAppState("workspace");
      setEntityPublication((current) => {
        if (!current.snapshot || current.snapshot.viewScope !== "entity") return current;
        if (!isBackofficeContentEntityWorkspaceViewId(resolved)) return current;
        if (current.snapshot.activeWorkspaceView === resolved) return current;
        const snapshot = current.snapshot;
        return {
          ...current,
          snapshot: buildContentBellissimaWorkspaceSnapshot({
            pageId: snapshot.entityId,
            title: snapshot.title,
            slug: snapshot.slug,
            subtitle: snapshot.subtitle,
            documentTypeAlias: snapshot.documentTypeAlias,
            statusLabel: snapshot.publishState === "published" ? "published" : "draft",
            canvasMode: resolved === "preview" ? "preview" : "edit",
            saveState: snapshot.editorSaveState,
            dirty: snapshot.dirty,
            canSave: snapshot.actionAvailability?.save ?? true,
            canPublish: snapshot.actionAvailability?.publish ?? true,
            canUnpublish:
              snapshot.actionAvailability?.unpublish ??
              snapshot.publishState === "published",
            canPreview:
              snapshot.actionAvailability?.preview ?? Boolean(snapshot.previewHref),
            canOpenPublic:
              snapshot.actionAvailability?.public_page ??
              Boolean(snapshot.publicHref),
            auditLogDegraded: snapshot.auditLogDegraded,
            governedPosture: snapshot.governedPosture,
            activeWorkspaceView: resolved,
            runtimeLinkage: snapshot.runtimeLinkage,
            runtimeLinkageLabel: snapshot.runtimeLinkageLabel,
          }),
        };
      });
    },
    [pathname],
  );

  const setActiveSideApp = useCallback((app: ContentBellissimaWorkspaceSideAppId) => {
    setActiveSideAppState(app);
  }, []);

  const setActiveInspectorSection = useCallback(
    (section: ContentBellissimaInspectorSectionId) => {
      setActiveSideAppState("workspace");
      setActiveInspectorSectionState(section);
    },
    [],
  );

  useEffect(() => {
    if (workspaceScopeKeyRef.current === workspaceScopeKey) return;
    workspaceScopeKeyRef.current = workspaceScopeKey;
    setActiveSideAppState("workspace");
    setActiveInspectorSectionState("content");
    setPreviewDevice("desktop");
    setPreviewLayoutMode("split");
    setShowPreviewColumn(true);
  }, [workspaceScopeKey]);

  const value = useMemo(
    () => ({
      snapshot,
      model: snapshot
        ? buildContentBellissimaWorkspaceModel(snapshot, {
            actionHandlers,
            setActiveView,
            activeSideApp,
            setActiveSideApp,
            activeInspectorSection,
            setActiveInspectorSection,
            previewDevice,
            previewLayoutMode,
            showPreviewColumn,
          })
        : null,
      publish,
      setActiveView,
      activeSideApp,
      setActiveSideApp,
      activeInspectorSection,
      setActiveInspectorSection,
      previewDevice,
      setPreviewDevice,
      previewLayoutMode,
      setPreviewLayoutMode,
      showPreviewColumn,
      setShowPreviewColumn,
    }),
    [
      actionHandlers,
      activeInspectorSection,
      activeSideApp,
      publish,
      setActiveInspectorSection,
      setActiveSideApp,
      setActiveView,
      previewDevice,
      previewLayoutMode,
      showPreviewColumn,
      snapshot,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBellissimaWorkspaceSnapshot(): ContentBellissimaWorkspaceSnapshot | null {
  return useContext(Ctx)?.snapshot ?? null;
}

export function useBellissimaWorkspaceModel(): ContentBellissimaWorkspaceModel | null {
  return useContext(Ctx)?.model ?? null;
}

export function useBellissimaWorkspaceViewState() {
  const c = useContext(Ctx);
  return {
    activeView: c?.snapshot?.activeWorkspaceView ?? null,
    setActiveView: c?.setActiveView ?? (() => undefined),
  };
}

export function useBellissimaEntityWorkspaceViewState() {
  const c = useContext(Ctx);
  const activeView =
    c?.snapshot?.activeWorkspaceView && isBackofficeContentEntityWorkspaceViewId(c.snapshot.activeWorkspaceView)
      ? c.snapshot.activeWorkspaceView
      : "content";
  return {
    activeView,
    setActiveView: (view: ContentBellissimaWorkspaceViewId) => c?.setActiveView(view),
  };
}

export function useBellissimaWorkspaceShellState() {
  const c = useContext(Ctx);
  return {
    activeSideApp: c?.activeSideApp ?? "workspace",
    setActiveSideApp: c?.setActiveSideApp ?? (() => undefined),
    activeInspectorSection: c?.activeInspectorSection ?? "content",
    setActiveInspectorSection: c?.setActiveInspectorSection ?? (() => undefined),
  };
}

export function useBellissimaWorkspacePresentationState() {
  const c = useContext(Ctx);
  return {
    previewDevice: c?.previewDevice ?? "desktop",
    setPreviewDevice: c?.setPreviewDevice ?? (() => undefined),
    previewLayoutMode: c?.previewLayoutMode ?? "split",
    setPreviewLayoutMode: c?.setPreviewLayoutMode ?? (() => undefined),
    showPreviewColumn: c?.showPreviewColumn ?? true,
    setShowPreviewColumn: c?.setShowPreviewColumn ?? (() => undefined),
  };
}

export function useBellissimaWorkspacePublisher() {
  const c = useContext(Ctx);
  const publish = c?.publish;
  return useCallback(
    (
      scope: BellissimaWorkspacePublishScope,
      next: ContentBellissimaWorkspaceSnapshot | null,
      options?: BellissimaWorkspacePublishOptions,
    ) => {
      publish?.(scope, next, options);
    },
    [publish]
  );
}

export function useBellissimaSectionWorkspacePublisher() {
  const publish = useBellissimaWorkspacePublisher();
  return useCallback(
    (next: ContentBellissimaWorkspaceSnapshot | null, options?: BellissimaWorkspacePublishOptions) => {
      publish("section", next, options);
    },
    [publish],
  );
}

export function useBellissimaEntityWorkspacePublisher() {
  const publish = useBellissimaWorkspacePublisher();
  return useCallback(
    (next: ContentBellissimaWorkspaceSnapshot | null, options?: BellissimaWorkspacePublishOptions) => {
      publish("entity", next, options);
    },
    [publish],
  );
}

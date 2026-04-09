/**
 * CP13 — Eksplisitt workspace-session modell (Umbraco 17 «Workspace Context»-paritet, type-nivå).
 * U32 — utvidet til reell workspace-host modell for views, actions, footer apps og delt section/entity-posture.
 */

import {
  BACKOFFICE_CONTENT_ENTITY_WORKSPACE_VIEWS,
  BACKOFFICE_CONTENT_WORKSPACE_VIEWS,
  getBackofficeContentEntityWorkspaceView,
  type BackofficeContentEntityWorkspaceViewId,
} from "@/lib/cms/backofficeExtensionRegistry";

/** Livssyklus for innhold der relevant (ærlig — ikke alle flater har draft/publish). */
export type WorkspaceLifecycleHint = "draft" | "published" | "preview" | "unknown";

/** Kort status i workspace-header (Umbraco-lignende signals). */
export type WorkspaceStatusChipTone = "neutral" | "success" | "warning" | "muted";

export type WorkspaceStatusChip = {
  label: string;
  tone?: WorkspaceStatusChipTone;
};

/**
 * Hva slags handling lenken representerer (kontrollplan — ikke ny motor).
 * @see docs/umbraco-parity/U21_ENTITY_ACTIONS_MODEL.md
 */
export type WorkspaceActionKind =
  | "local_editor"
  | "review"
  | "runtime_route"
  | "preview"
  | "navigation";

/**
 * Beskriver hva redaktør ser i arbeidsflaten: objekt-type, kobling til manifest og eventuell runtime-kobling.
 */
export type BackofficeWorkspaceSession = {
  /** `BackofficeExtensionEntry.id` */
  extensionId: string;
  /** `data-workspace` / surface id (f.eks. `week-menu`) */
  workspaceId: string;
  /** Samme som manifest `collectionKey` der satt */
  collectionKey?: string;
  lifecycle?: WorkspaceLifecycleHint;
  /** True når felt/flate speiler operativ runtime (ordre, avtale, uke-API) — kun lesing/review */
  runtimeLinked?: boolean;
};

/** Lesbar etikett for livssyklus (testbar hjelper). */
export function workspaceLifecycleLabel(h: WorkspaceLifecycleHint): string {
  switch (h) {
    case "draft":
      return "Utkast";
    case "published":
      return "Publisert";
    case "preview":
      return "Forhåndsvisning";
    default:
      return "Ukjent livssyklus";
  }
}

/** Code-governed vs legacy innhold (ærlig — ikke alle sider har envelope). */
export type ContentGovernedPosture = "envelope" | "legacy" | "unknown";

export type ContentSectionWorkspaceViewId = "overview" | "growth" | "recycle-bin";
export type ContentBellissimaWorkspaceViewId =
  | BackofficeContentEntityWorkspaceViewId
  | ContentSectionWorkspaceViewId;
export type ContentBellissimaWorkspaceSideAppId = "workspace" | "ai" | "runtime";
export type ContentBellissimaPreviewDeviceId = "desktop" | "tablet" | "mobile";
export type ContentBellissimaPreviewLayoutMode = "split" | "full";
export type ContentBellissimaInspectorSectionId =
  | "content"
  | "design"
  | "seo"
  | "governance"
  | "runtime";

export type BellissimaWorkspaceActionId =
  | "create"
  | "publish"
  | "unpublish"
  | "save"
  | "preview"
  | "history"
  | "settings"
  | "public_page"
  | "reload";

export type WorkspaceHistoryStatus = "ready" | "degraded" | "unavailable";

export type BellissimaEntityActionId =
  | "edit"
  | "preview"
  | "history"
  | "settings"
  | "schema"
  /** U96 — persisted document type / property type workspace (vs. global schema read) */
  | "document_type_runtime"
  | "management"
  | "governance"
  | "json"
  | "public_page"
  | "copy_link";

export type ContentBellissimaActionId =
  | BellissimaWorkspaceActionId
  | BellissimaEntityActionId;

export type ContentBellissimaActionHandler = () => void | Promise<void>;
export type ContentBellissimaActionHandlerMap = Partial<
  Record<ContentBellissimaActionId, ContentBellissimaActionHandler>
>;
export type ContentBellissimaActionAvailability = Partial<
  Record<ContentBellissimaActionId, boolean>
>;

export type ContentBellissimaWorkspaceViewDescriptor = {
  id: ContentBellissimaWorkspaceViewId;
  label: string;
  description: string;
  active: boolean;
  href?: string | null;
  exact?: boolean;
  onSelect?: () => void;
};

export type ContentBellissimaWorkspaceSideAppDescriptor = {
  id: ContentBellissimaWorkspaceSideAppId;
  label: string;
  description: string;
  active: boolean;
  onSelect?: () => void;
};

export type ContentBellissimaInspectorSectionDescriptor = {
  id: ContentBellissimaInspectorSectionId;
  label: string;
  description: string;
  active: boolean;
  onSelect?: () => void;
};

export type ContentBellissimaWorkspaceActionDescriptor = {
  id: ContentBellissimaActionId;
  label: string;
  enabled: boolean;
  placement: "primary" | "secondary" | "entity";
  href?: string | null;
  onSelect?: ContentBellissimaActionHandler;
  description?: string;
  look?: "primary" | "secondary" | "outline";
  tone?: "default" | "positive" | "warning" | "danger";
};

export type ContentBellissimaWorkspaceFooterApp = {
  id: string;
  group: "identity" | "status" | "shortcut";
  label: string;
  value: string;
  tone: "neutral" | "success" | "warning";
  href?: string | null;
  description?: string;
};

export type ContentBellissimaWorkspaceViewScope = "section" | "entity";
export type ContentBellissimaWorkspaceEntityType = "section" | "page" | "virtual_root";
export type ContentBellissimaPreviewState =
  | "workspace_preview"
  | "public_page"
  | "unavailable";
export type ContentBellissimaRuntimeLinkage =
  | "editorial_only"
  | "runtime_linked"
  | "management_read";
export type ContentBellissimaPublishState =
  | "draft"
  | "published"
  | "not_applicable";

/** U32 — Bellissima-lignende workspace-snapshot (én kilde for host / header / footer / apps). */
export type ContentBellissimaWorkspaceSnapshot = BackofficeWorkspaceSession & {
  sectionId: "content";
  sectionLabel: string;
  workspaceLabel: string;
  viewScope: ContentBellissimaWorkspaceViewScope;
  entityId: string | null;
  entityType: ContentBellissimaWorkspaceEntityType;
  title: string;
  slug: string | null;
  subtitle: string | null;
  documentTypeAlias: string | null;
  publishState: ContentBellissimaPublishState;
  canvasMode: "edit" | "preview";
  /** Redaksjonelt lagringsflagg (idle/dirty/saving/...) */
  editorSaveState: string;
  dirty: boolean;
  /**
   * True når `content_audit_log` ikke er tilgjengelig og API returnerer degraded (superadmin).
   * `null` = ikke hentet eller ikke tilgang (f.eks. ikke superadmin).
   */
  auditLogDegraded: boolean | null;
  /** Document type envelope vs legacy / ukjent. */
  governedPosture: ContentGovernedPosture;
  /** Aktiv workspace-visning. Seksjonsflater bruker overview/growth/recycle-bin. */
  activeWorkspaceView: ContentBellissimaWorkspaceViewId;
  previewState: ContentBellissimaPreviewState;
  previewHref: string | null;
  publicHref: string | null;
  runtimeLinkage: ContentBellissimaRuntimeLinkage;
  runtimeLinkageLabel: string | null;
  historyStatus: WorkspaceHistoryStatus;
  primaryActionIds: readonly BellissimaWorkspaceActionId[];
  secondaryActionIds: readonly BellissimaWorkspaceActionId[];
  actionAvailability?: ContentBellissimaActionAvailability;
};

export type ContentBellissimaWorkspaceModel = {
  snapshot: ContentBellissimaWorkspaceSnapshot;
  views: readonly ContentBellissimaWorkspaceViewDescriptor[];
  sideApps: readonly ContentBellissimaWorkspaceSideAppDescriptor[];
  inspectorSections: readonly ContentBellissimaInspectorSectionDescriptor[];
  primaryActions: readonly ContentBellissimaWorkspaceActionDescriptor[];
  secondaryActions: readonly ContentBellissimaWorkspaceActionDescriptor[];
  entityActions: readonly ContentBellissimaWorkspaceActionDescriptor[];
  footerApps: readonly ContentBellissimaWorkspaceFooterApp[];
};

export type BuildContentBellissimaWorkspaceModelOptions = {
  actionHandlers?: ContentBellissimaActionHandlerMap;
  setActiveView?: (view: BackofficeContentEntityWorkspaceViewId) => void;
  activeSideApp?: ContentBellissimaWorkspaceSideAppId;
  setActiveSideApp?: (app: ContentBellissimaWorkspaceSideAppId) => void;
  activeInspectorSection?: ContentBellissimaInspectorSectionId;
  setActiveInspectorSection?: (section: ContentBellissimaInspectorSectionId) => void;
  previewDevice?: ContentBellissimaPreviewDeviceId;
  previewLayoutMode?: ContentBellissimaPreviewLayoutMode;
  showPreviewColumn?: boolean;
};

type BuildBellissimaSnapshotInput = {
  pageId: string | null;
  title: string;
  slug: string | null;
  subtitle?: string | null;
  documentTypeAlias: string | null;
  statusLabel: "draft" | "published";
  canvasMode: "edit" | "preview";
  saveState: string;
  dirty: boolean;
  canSave?: boolean;
  canPublish?: boolean;
  canUnpublish?: boolean;
  canPreview?: boolean;
  canOpenPublic?: boolean;
  /** Superadmin audit route — degradert tabell / schema */
  auditLogDegraded?: boolean | null;
  governedPosture?: ContentGovernedPosture;
  activeWorkspaceView?: BackofficeContentEntityWorkspaceViewId;
  runtimeLinkage?: ContentBellissimaRuntimeLinkage;
  runtimeLinkageLabel?: string | null;
};

export type BuildContentSectionBellissimaWorkspaceSnapshotInput = {
  viewId: ContentSectionWorkspaceViewId;
  title: string;
  subtitle?: string | null;
  runtimeLinkage?: ContentBellissimaRuntimeLinkage;
  runtimeLinkageLabel?: string | null;
  primaryActionIds?: readonly BellissimaWorkspaceActionId[];
  secondaryActionIds?: readonly BellissimaWorkspaceActionId[];
  actionAvailability?: ContentBellissimaActionAvailability;
};

function resolveContentWorkspaceLabel(
  activeWorkspaceView: ContentBellissimaWorkspaceViewId,
): string {
  if (isBackofficeContentEntityWorkspaceViewId(activeWorkspaceView)) {
    return getBackofficeContentEntityWorkspaceView(activeWorkspaceView).label;
  }
  return (
    BACKOFFICE_CONTENT_WORKSPACE_VIEWS.find((view) => view.id === activeWorkspaceView)?.label ??
    "Innhold"
  );
}

function resolvePrimaryWorkspaceActions(
  activeWorkspaceView: BackofficeContentEntityWorkspaceViewId,
  hasPreview: boolean,
  canPublish: boolean,
): readonly BellissimaWorkspaceActionId[] {
  switch (activeWorkspaceView) {
    case "history":
      return hasPreview ? ["save", "preview"] : ["save"];
    case "preview":
      return canPublish
        ? hasPreview
          ? ["save", "publish", "public_page"]
          : ["save", "publish"]
        : hasPreview
          ? ["save", "public_page"]
          : ["save"];
    case "global":
      return hasPreview ? ["save", "settings", "preview"] : ["save", "settings"];
    case "design":
      return hasPreview ? ["save", "preview", "settings"] : ["save", "settings"];
    default:
      return canPublish
        ? hasPreview
          ? ["save", "publish", "preview"]
          : ["save", "publish"]
        : hasPreview
          ? ["save", "preview"]
          : ["save"];
  }
}

function resolveSecondaryWorkspaceActions(
  activeWorkspaceView: BackofficeContentEntityWorkspaceViewId,
  publishState: "draft" | "published",
  canUnpublish: boolean,
): readonly BellissimaWorkspaceActionId[] {
  const withCommon = (items: readonly BellissimaWorkspaceActionId[]) =>
    publishState === "published" && canUnpublish
      ? ([...items, "unpublish"] as const)
      : items;

  switch (activeWorkspaceView) {
    case "history":
      return withCommon(
        publishState === "published"
          ? ["history", "settings", "public_page"]
          : ["history", "settings"],
      );
    case "preview":
      return withCommon(
        publishState === "published"
          ? ["history", "settings", "public_page"]
          : ["history", "settings"],
      );
    case "global":
      return withCommon(["history"]);
    case "design":
      return withCommon(
        publishState === "published" ? ["history", "public_page"] : ["history"],
      );
    default:
      return withCommon(
        publishState === "published"
          ? ["history", "settings", "public_page"]
          : ["history", "settings"],
      );
  }
}

function resolveActionLook(
  actionId: ContentBellissimaActionId,
): "primary" | "secondary" | "outline" {
  switch (actionId) {
    case "create":
    case "save":
    case "publish":
      return "primary";
    case "unpublish":
      return "secondary";
    default:
      return "outline";
  }
}

function resolveActionTone(
  actionId: ContentBellissimaActionId,
): "default" | "positive" | "warning" | "danger" {
  switch (actionId) {
    case "publish":
      return "positive";
    case "unpublish":
      return "warning";
    default:
      return "default";
  }
}

function resolveActionDescription(
  actionId: ContentBellissimaActionId,
): string | undefined {
  switch (actionId) {
    case "create":
      return "Opprett ny side fra content-first landingen.";
    case "publish":
      return "Publiser siste godkjente endringer.";
    case "unpublish":
      return "Ta siden ut av publisering og gå tilbake til kladd.";
    case "save":
      return "Lagre gjeldende endringer uten å forlate arbeidsflaten.";
    case "preview":
      return "Bytt til workspace-forhåndsvisning.";
    case "history":
      return "Åpne historikk, audit og governance-posture.";
    case "settings":
      return "Åpne CMS-innstillinger og styringsflater.";
    case "schema":
      return "Åpne property editor-systemet og schema-read for denne entiteten.";
    case "management":
      return "Åpne management-read eller relaterte management-objekter.";
    case "governance":
      return "Åpne governance-innsikt og policy-flater for denne entiteten.";
    case "json":
      return "Åpne JSON/read-model for sporbarhet og operatorstøtte.";
    case "public_page":
      return "Åpne den publiserte siden i offentlig runtime når slug finnes.";
    case "edit":
      return "Åpne den primære arbeidsflaten for denne entiteten.";
    case "copy_link":
      return "Kopier lenke til denne entiteten.";
    default:
      return undefined;
  }
}

function resolvePreviewState(
  previewHref: string | null,
  publicHref: string | null,
  canOpenPublic: boolean,
): ContentBellissimaPreviewState {
  if (canOpenPublic && publicHref) return "public_page";
  if (!previewHref) return "unavailable";
  return "workspace_preview";
}

function resolveRuntimeLinkageLabel(
  runtimeLinkage: ContentBellissimaRuntimeLinkage,
): string {
  switch (runtimeLinkage) {
    case "runtime_linked":
      return "Runtime-koblet";
    case "management_read":
      return "Management read";
    default:
      return "Redaksjonell kontroll";
  }
}

export function contentWorkspaceSideAppLabel(
  sideApp: ContentBellissimaWorkspaceSideAppId,
): string {
  switch (sideApp) {
    case "ai":
      return "AI";
    case "runtime":
      return "Runtime";
    default:
      return "Arbeidsflate";
  }
}

export function contentInspectorSectionLabel(
  section: ContentBellissimaInspectorSectionId,
): string {
  switch (section) {
    case "design":
      return "Design";
    case "seo":
      return "SEO";
    case "governance":
      return "Governance";
    case "runtime":
      return "Runtime";
    default:
      return "Innhold";
  }
}

function contentWorkspaceSideAppDescription(
  sideApp: ContentBellissimaWorkspaceSideAppId,
): string {
  switch (sideApp) {
    case "ai":
      return "AI-forslag, kontekst og redaksjonelle verktøy for aktiv side.";
    case "runtime":
      return "Historikk, driftssignaler og degradert runtime-status for aktiv side.";
    default:
      return "Egenskaper, design og governance for aktiv side.";
  }
}

function contentInspectorSectionDescription(
  section: ContentBellissimaInspectorSectionId,
): string {
  switch (section) {
    case "design":
      return "Layout, design-scope og presentasjonsvalg.";
    case "seo":
      return "Metadata, deling og søkeresultat-signaler.";
    case "governance":
      return "Dokumenttype, envelope og navigasjonspolicy.";
    case "runtime":
      return "Runtime-kobling, tekniske scripts og avanserte overstyringer.";
    default:
      return "Primære egenskaper, sideinnhold og listing-meta.";
  }
}

/**
 * Bygger kanonisk snapshot for innholds-redigerer.
 */
export function buildContentBellissimaWorkspaceSnapshot(
  input: BuildBellissimaSnapshotInput,
): ContentBellissimaWorkspaceSnapshot {
  const lifecycle: WorkspaceLifecycleHint =
    input.canvasMode === "preview"
      ? "preview"
      : input.statusLabel === "published"
        ? "published"
        : "draft";
  const auditLogDegraded = input.auditLogDegraded ?? null;
  const governedPosture: ContentGovernedPosture =
    input.governedPosture ??
    (!input.pageId ? "unknown" : input.documentTypeAlias ? "envelope" : "legacy");
  const activeWorkspaceView = input.activeWorkspaceView ?? "content";
  const previewHref = input.pageId
    ? `/backoffice/preview/${encodeURIComponent(input.pageId)}`
    : null;
  const publicHref = input.slug?.trim()
    ? `/${input.slug.replace(/^\/+/, "")}`
    : null;
  const historyStatus: WorkspaceHistoryStatus =
    auditLogDegraded === true
      ? "degraded"
      : auditLogDegraded === false
        ? "ready"
        : "unavailable";
  const publishState: ContentBellissimaPublishState =
    input.statusLabel === "published" ? "published" : "draft";
  const canPublish = input.canPublish ?? true;
  const canSave = input.canSave ?? true;
  const canUnpublish = input.canUnpublish ?? publishState === "published";
  const canPreview = input.canPreview ?? Boolean(previewHref);
  const canOpenPublic =
    input.canOpenPublic ?? (publishState === "published" && Boolean(publicHref));

  return {
    extensionId: "nav.content",
    sectionId: "content",
    sectionLabel: "Innhold & vekst",
    workspaceId: "content-editor",
    workspaceLabel: resolveContentWorkspaceLabel(activeWorkspaceView),
    collectionKey: "contentTree",
    viewScope: "entity",
    entityId: input.pageId,
    entityType: "page",
    title: input.title,
    slug: input.slug,
    subtitle:
      input.subtitle ??
      "Tree -> workspace -> preview -> inspector følger samme content-host og delte Bellissima-kontekst.",
    documentTypeAlias: input.documentTypeAlias,
    publishState,
    canvasMode: input.canvasMode,
    editorSaveState: input.saveState,
    dirty: input.dirty,
    auditLogDegraded,
    governedPosture,
    activeWorkspaceView,
    previewState: resolvePreviewState(previewHref, publicHref, canOpenPublic),
    previewHref,
    publicHref,
    runtimeLinkage: input.runtimeLinkage ?? "editorial_only",
    runtimeLinkageLabel:
      input.runtimeLinkageLabel ??
      resolveRuntimeLinkageLabel(input.runtimeLinkage ?? "editorial_only"),
    historyStatus,
    primaryActionIds: resolvePrimaryWorkspaceActions(
      activeWorkspaceView,
      canPreview,
      canPublish,
    ),
    secondaryActionIds: resolveSecondaryWorkspaceActions(
      activeWorkspaceView,
      publishState === "published" ? "published" : "draft",
      canUnpublish,
    ),
    actionAvailability: {
      save: canSave,
      publish: canPublish,
      unpublish: canUnpublish,
      preview: canPreview,
      public_page: canOpenPublic,
      history: true,
      settings: true,
      edit: true,
    },
    lifecycle,
    runtimeLinked: false,
  };
}

export function buildContentSectionBellissimaWorkspaceSnapshot(
  input: BuildContentSectionBellissimaWorkspaceSnapshotInput,
): ContentBellissimaWorkspaceSnapshot {
  const workspaceId =
    input.viewId === "growth"
      ? "content-growth"
      : input.viewId === "recycle-bin"
        ? "content-recycle-bin"
        : "content-overview";

  return {
    extensionId: "nav.content",
    sectionId: "content",
    sectionLabel: "Innhold & vekst",
    workspaceId,
    workspaceLabel: resolveContentWorkspaceLabel(input.viewId),
    collectionKey: "contentTree",
    viewScope: "section",
    entityId: null,
    entityType: "section",
    title: input.title,
    slug: null,
    subtitle:
      input.subtitle ??
      "Content-first section der tree er primær navigasjon og workspaces monteres uten parallelle shell-stakker.",
    documentTypeAlias: null,
    publishState: "not_applicable",
    canvasMode: "edit",
    editorSaveState: "klar",
    dirty: false,
    auditLogDegraded: null,
    governedPosture: "unknown",
    activeWorkspaceView: input.viewId,
    previewState: "unavailable",
    previewHref: null,
    publicHref: null,
    runtimeLinkage: input.runtimeLinkage ?? "editorial_only",
    runtimeLinkageLabel:
      input.runtimeLinkageLabel ??
      resolveRuntimeLinkageLabel(input.runtimeLinkage ?? "editorial_only"),
    historyStatus: "unavailable",
    primaryActionIds: input.primaryActionIds ?? [],
    secondaryActionIds: input.secondaryActionIds ?? ["settings"],
    actionAvailability: input.actionAvailability,
    lifecycle: "unknown",
    runtimeLinked: false,
  };
}

function actionHrefForSnapshot(
  snapshot: ContentBellissimaWorkspaceSnapshot,
  actionId: ContentBellissimaActionId,
): string | null {
  switch (actionId) {
    case "public_page":
      return snapshot.publishState === "published" && snapshot.publicHref
        ? snapshot.publicHref
        : null;
    case "settings":
      return "/backoffice/settings";
    case "schema":
      return "/backoffice/settings/schema";
    case "management":
      return snapshot.documentTypeAlias
        ? `/backoffice/settings/document-types/${encodeURIComponent(snapshot.documentTypeAlias)}`
        : "/backoffice/settings/management-read";
    case "governance":
      return "/backoffice/settings/governance-insights";
    default:
      return null;
  }
}

function defaultActionHandlerForSnapshot(
  snapshot: ContentBellissimaWorkspaceSnapshot,
  actionId: ContentBellissimaActionId,
  setActiveView?: (view: BackofficeContentEntityWorkspaceViewId) => void,
): ContentBellissimaActionHandler | undefined {
  if (snapshot.viewScope !== "entity" || !setActiveView) return undefined;
  switch (actionId) {
    case "edit":
      return () => setActiveView("content");
    case "preview":
      return () => setActiveView("preview");
    case "history":
      return () => setActiveView("history");
    default:
      return undefined;
  }
}

function actionEnabledForSnapshot(
  snapshot: ContentBellissimaWorkspaceSnapshot,
  actionId: ContentBellissimaActionId,
): boolean {
  const fromSnapshot = snapshot.actionAvailability?.[actionId];
  if (typeof fromSnapshot === "boolean") return fromSnapshot;
  if (actionId === "public_page") return Boolean(snapshot.publicHref);
  if (actionId === "management") return Boolean(snapshot.documentTypeAlias);
  if (actionId === "schema") return true;
  return true;
}

export function buildContentBellissimaWorkspaceModel(
  snapshot: ContentBellissimaWorkspaceSnapshot,
  options: BuildContentBellissimaWorkspaceModelOptions = {},
): ContentBellissimaWorkspaceModel {
  const activeSideApp = options.activeSideApp ?? "workspace";
  const activeInspectorSection = options.activeInspectorSection ?? "content";
  const previewDevice = options.previewDevice ?? "desktop";
  const previewLayoutMode = options.previewLayoutMode ?? "split";
  const showPreviewColumn = options.showPreviewColumn ?? true;
  const views: ContentBellissimaWorkspaceViewDescriptor[] =
    snapshot.viewScope === "section"
      ? BACKOFFICE_CONTENT_WORKSPACE_VIEWS.map((view) => ({
          id: (view.id ?? "overview") as ContentSectionWorkspaceViewId,
          label: view.label,
          description: view.description ?? view.label,
          active: view.id === snapshot.activeWorkspaceView,
          href: view.href,
          exact: view.exact,
        }))
      : BACKOFFICE_CONTENT_ENTITY_WORKSPACE_VIEWS.map((view) => ({
          id: view.id,
          label: view.label,
          description: view.description,
          active: view.id === snapshot.activeWorkspaceView,
          onSelect: options.setActiveView
            ? () => options.setActiveView?.(view.id)
            : undefined,
        }));

  const sideApps: ContentBellissimaWorkspaceSideAppDescriptor[] =
    snapshot.viewScope === "section"
      ? [
          {
            id: "workspace",
            label: "Seksjon",
            description: "Tree-first seksjonsflate uten parallell editor.",
            active: true,
          },
        ]
      : (["workspace", "ai", "runtime"] as const).map((sideApp) => ({
          id: sideApp,
          label: contentWorkspaceSideAppLabel(sideApp),
          description: contentWorkspaceSideAppDescription(sideApp),
          active: activeSideApp === sideApp,
          onSelect: options.setActiveSideApp
            ? () => options.setActiveSideApp?.(sideApp)
            : undefined,
        }));

  const inspectorSections: ContentBellissimaInspectorSectionDescriptor[] =
    snapshot.viewScope === "entity"
      ? (
          [
            "content",
            "design",
            "seo",
            "governance",
            "runtime",
          ] as const
        ).map((section) => ({
          id: section,
          label: contentInspectorSectionLabel(section),
          description: contentInspectorSectionDescription(section),
          active: activeInspectorSection === section,
          onSelect:
            options.setActiveInspectorSection || options.setActiveSideApp
              ? () => {
                  options.setActiveSideApp?.("workspace");
                  options.setActiveInspectorSection?.(section);
                }
              : undefined,
        }))
      : [];

  const toDescriptor = (
    actionId: ContentBellissimaActionId,
    placement: "primary" | "secondary" | "entity",
  ): ContentBellissimaWorkspaceActionDescriptor => {
    const defaultHandler = defaultActionHandlerForSnapshot(
      snapshot,
      actionId,
      options.setActiveView,
    );
    return {
      id: actionId,
      label: workspaceActionLabel(actionId),
      enabled: actionEnabledForSnapshot(snapshot, actionId),
      placement,
      href: actionHrefForSnapshot(snapshot, actionId),
      onSelect: options.actionHandlers?.[actionId] ?? defaultHandler,
      description: resolveActionDescription(actionId),
      look: resolveActionLook(actionId),
      tone: resolveActionTone(actionId),
    };
  };

  const primaryActions = snapshot.primaryActionIds.map((actionId) =>
    toDescriptor(actionId, "primary"),
  );
  const secondaryActions = snapshot.secondaryActionIds.map((actionId) =>
    toDescriptor(actionId, "secondary"),
  );
  const entityActions =
    snapshot.viewScope === "entity"
      ? (
          [
            "edit",
            "preview",
            "history",
            snapshot.documentTypeAlias ? "management" : null,
            snapshot.documentTypeAlias ? "schema" : null,
            "settings",
            snapshot.publishState === "published" ? "public_page" : null,
          ] as const
        )
          .filter((actionId) => actionId !== null)
          .map((actionId) => toDescriptor(actionId, "entity"))
      : [];

  const footerApps: ContentBellissimaWorkspaceFooterApp[] =
    snapshot.viewScope === "section"
      ? [
          {
            id: "workspace",
            group: "identity",
            label: "Arbeidsflate",
            value: snapshot.workspaceLabel,
            tone: "neutral",
          },
          {
            id: "view",
            group: "identity",
            label: "Visning",
            value: resolveContentWorkspaceLabel(snapshot.activeWorkspaceView),
            tone: "neutral",
          },
          {
            id: "navigation",
            group: "status",
            label: "Navigasjon",
            value: "Tree først",
            tone: "neutral",
            description: "Treet er primær inngang, workspacen er sekundær flate.",
          },
          {
            id: "runtime",
            group: "status",
            label: "Runtime",
            value: snapshot.runtimeLinkageLabel ?? resolveRuntimeLinkageLabel(snapshot.runtimeLinkage),
            tone: "neutral",
          },
          {
            id: "posture",
            group: "status",
            label: "Posture",
            value: "Content-first section",
            tone: "neutral",
          },
          {
            id: "settings_shortcut",
            group: "shortcut",
            label: "Innstillinger",
            value: "Åpne",
            tone: "neutral",
            href: "/backoffice/settings",
          },
        ]
      : [
          {
            id: "workspace",
            group: "identity",
            label: "Arbeidsflate",
            value: snapshot.workspaceLabel,
            tone: "neutral",
          },
          {
            id: "view",
            group: "identity",
            label: "Visning",
            value: resolveContentWorkspaceLabel(snapshot.activeWorkspaceView),
            tone: "neutral",
          },
          {
            id: "publish_state",
            group: "status",
            label: "Publisering",
            value:
              snapshot.publishState === "published"
                ? "Publisert"
                : snapshot.publishState === "draft"
                  ? "Kladd"
                  : "Ikke relevant",
            tone: snapshot.publishState === "published" ? "success" : "neutral",
          },
          {
            id: "save_state",
            group: "status",
            label: "Lagring",
            value: snapshot.dirty
              ? `${snapshot.editorSaveState} · ulagret`
              : snapshot.editorSaveState,
            tone: snapshot.dirty ? "warning" : "neutral",
          },
          {
            id: "history",
            group: "status",
            label: "Historikk",
            value: workspaceHistoryStatusLabel(snapshot.historyStatus),
            tone: workspaceHistoryStatusTone(snapshot.historyStatus),
          },
          {
            id: "runtime",
            group: "status",
            label: "Runtime",
            value:
              snapshot.runtimeLinkageLabel ??
              resolveRuntimeLinkageLabel(snapshot.runtimeLinkage),
            tone: "neutral",
          },
          {
            id: "governance",
            group: "status",
            label: "Governance",
            value: contentGovernedPostureLabel(snapshot.governedPosture),
            tone: snapshot.governedPosture === "legacy" ? "warning" : "neutral",
          },
          {
            id: "inspector",
            group: "status",
            label: "Inspector",
            value:
              activeSideApp === "workspace"
                ? contentInspectorSectionLabel(activeInspectorSection)
                : contentWorkspaceSideAppLabel(activeSideApp),
            tone: activeSideApp === "runtime" ? "warning" : "neutral",
            description: "Aktivt fokus i arbeidsflaten kommer fra delt Bellissima-kontekst.",
          },
        ];

  if (snapshot.viewScope === "entity" && snapshot.documentTypeAlias) {
    footerApps.push({
      id: "document_type",
      group: "shortcut",
      label: "Document type",
      value: snapshot.documentTypeAlias,
      tone: "neutral",
      href: `/backoffice/settings/document-types/${encodeURIComponent(snapshot.documentTypeAlias)}`,
    });
    footerApps.push({
      id: "schema_shortcut",
      group: "shortcut",
      label: "Schema",
      value: "Feltflyt",
      tone: "neutral",
      href: "/backoffice/settings/schema",
      description: "Schema -> configured instance -> UI -> preset/defaults.",
    });
  }
  if (snapshot.viewScope === "entity") {
    footerApps.push({
      id: "settings_shortcut",
      group: "shortcut",
      label: "Innstillinger",
      value: "CMS",
      tone: "neutral",
      href: "/backoffice/settings",
    });
    footerApps.push({
      id: "governance_shortcut",
      group: "shortcut",
      label: "Governance",
      value: "Bruk",
      tone: "neutral",
      href: "/backoffice/settings/governance-insights",
    });
  }
  if (snapshot.viewScope === "entity" && snapshot.previewHref) {
    footerApps.push({
      id: "preview",
      group: "shortcut",
      label: "Preview",
      value: workspacePreviewStateLabel(snapshot.previewState),
      tone: "neutral",
      href:
        snapshot.previewState === "public_page"
          ? snapshot.publicHref ?? snapshot.previewHref
          : snapshot.previewHref,
    });
  }

  return {
    snapshot,
    views,
    sideApps,
    inspectorSections,
    primaryActions,
    secondaryActions,
    entityActions,
    footerApps,
  };
}

/** Lesbar etikett for styring (footer / apps). */
export function contentGovernedPostureLabel(p: ContentGovernedPosture): string {
  switch (p) {
    case "envelope":
      return "Envelope (dokumenttype)";
    case "legacy":
      return "Legacy / uten dokumenttype";
    default:
      return "Ukjent";
  }
}

export function workspaceHistoryStatusLabel(status: WorkspaceHistoryStatus): string {
  switch (status) {
    case "ready":
      return "Historikk klar";
    case "degraded":
      return "Historikk degradert";
    default:
      return "Historikk utilgjengelig";
  }
}

export function workspaceHistoryStatusTone(
  status: WorkspaceHistoryStatus,
): "neutral" | "success" | "warning" {
  switch (status) {
    case "ready":
      return "success";
    case "degraded":
      return "warning";
    default:
      return "neutral";
  }
}

export function workspacePreviewStateLabel(
  previewState: ContentBellissimaPreviewState,
): string {
  switch (previewState) {
    case "workspace_preview":
      return "Workspace-preview";
    case "public_page":
      return "Offentlig side";
    default:
      return "Ikke tilgjengelig";
  }
}

export function contentPreviewDeviceLabel(
  previewDevice: ContentBellissimaPreviewDeviceId,
): string {
  switch (previewDevice) {
    case "mobile":
      return "Mobil";
    case "tablet":
      return "Nettbrett";
    default:
      return "Desktop";
  }
}

export function contentPreviewLayoutLabel(
  previewLayoutMode: ContentBellissimaPreviewLayoutMode,
): string {
  switch (previewLayoutMode) {
    case "full":
      return "Full bredde";
    default:
      return "Delt";
  }
}

export function isContentSectionWorkspaceViewId(
  view: string,
): view is ContentSectionWorkspaceViewId {
  return view === "overview" || view === "growth" || view === "recycle-bin";
}

export function isBackofficeContentEntityWorkspaceViewId(
  view: string,
): view is BackofficeContentEntityWorkspaceViewId {
  return (
    view === "content" ||
    view === "preview" ||
    view === "history" ||
    view === "global" ||
    view === "design"
  );
}

export function contentWorkspaceViewLabel(
  view: ContentBellissimaWorkspaceViewId | string,
): string {
  const normalized = view.trim().toLowerCase();
  if (normalized === "page" || normalized === "editor") {
    return resolveContentWorkspaceLabel("content");
  }
  if (isBackofficeContentEntityWorkspaceViewId(normalized)) {
    return resolveContentWorkspaceLabel(normalized);
  }
  if (isContentSectionWorkspaceViewId(normalized)) {
    return resolveContentWorkspaceLabel(normalized);
  }
  return "Innhold";
}

export function workspaceActionLabel(actionId: ContentBellissimaActionId): string {
  switch (actionId) {
    case "create":
      return "Opprett";
    case "edit":
      return "Åpne arbeidsflate";
    case "publish":
      return "Publiser";
    case "unpublish":
      return "Sett til kladd";
    case "save":
      return "Lagre";
    case "preview":
      return "Forhåndsvis";
    case "history":
      return "Historikk";
    case "settings":
      return "Innstillinger";
    case "schema":
      return "Schema";
    case "document_type_runtime":
      return "Document type (runtime)";
    case "management":
      return "Management";
    case "governance":
      return "Governance";
    case "json":
      return "JSON";
    case "public_page":
      return "Vis side";
    case "copy_link":
      return "Kopier lenke";
    case "reload":
      return "Last på nytt";
    default:
      return actionId;
  }
}

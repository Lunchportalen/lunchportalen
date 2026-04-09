import {
  getBackofficeSettingsCollectionById,
  type BackofficeSettingsCollectionDefinition,
  type BackofficeSettingsCollectionId,
} from "@/lib/cms/backofficeExtensionRegistry";

export type BackofficeManagementWorkspaceSignalTone = "neutral" | "success" | "warning";

export type BackofficeManagementWorkspaceSignal = {
  label: string;
  value: string;
  tone?: BackofficeManagementWorkspaceSignalTone;
  description?: string;
};

export type BackofficeManagementWorkspaceAction = {
  label: string;
  href: string;
  look?: "primary" | "secondary" | "outline";
};

export type BackofficeManagementWorkspaceModel = {
  collection: BackofficeSettingsCollectionDefinition;
  title: string;
  description: string;
  routeKind: "overview" | "collection" | "workspace" | "detail";
  signals: readonly BackofficeManagementWorkspaceSignal[];
  primaryAction: BackofficeManagementWorkspaceAction | null;
  secondaryActions: readonly BackofficeManagementWorkspaceAction[];
  relatedLinks: readonly BackofficeManagementWorkspaceAction[];
  note: string | null;
};

export function backofficeSettingsHonestyLabel(
  honesty: BackofficeSettingsCollectionDefinition["honesty"],
): string {
  switch (honesty) {
    case "code_governed":
      return "Kode-styrt";
    case "runtime_managed":
      return "Runtime-styrt";
    default:
      return "Runtime-lest";
  }
}

export function backofficeSettingsKindLabel(
  kind: BackofficeSettingsCollectionDefinition["kind"] | "detail",
): string {
  switch (kind) {
    case "collection":
      return "Samlingsflyt";
    case "overview":
      return "Seksjonsoversikt";
    case "detail":
      return "Detaljarbeidsflate";
    default:
      return "Arbeidsflate";
  }
}

export function backofficeSettingsObjectClassLabel(
  objectClass: BackofficeSettingsCollectionDefinition["objectClass"],
): string {
  switch (objectClass) {
    case "composition":
      return "Composition";
    case "document_type":
      return "Document type";
    case "data_type":
      return "Data type";
    case "policy":
      return "Policy";
    case "schema":
      return "Property editor system";
    case "registry":
      return "Registry";
    case "governance":
      return "Governance";
    case "system":
      return "System";
    default:
      return "Seksjon";
  }
}

export function backofficeSettingsFlowLabel(
  flowKind: BackofficeSettingsCollectionDefinition["flowKind"],
): string {
  switch (flowKind) {
    case "collection_to_detail":
      return "Collection -> detail";
    case "workspace_read":
      return "Workspace read";
    case "runtime_manage":
      return "Runtime manage";
    case "runtime_read":
      return "Runtime read";
    default:
      return "Oversikt";
  }
}

export function buildBackofficeManagementWorkspaceModel(params: {
  collectionId: BackofficeSettingsCollectionId;
  title?: string;
  description?: string;
  routeKind?: "overview" | "collection" | "workspace" | "detail";
  signals?: readonly BackofficeManagementWorkspaceSignal[];
  primaryAction?: BackofficeManagementWorkspaceAction | null;
  secondaryActions?: readonly BackofficeManagementWorkspaceAction[];
  relatedLinks?: readonly BackofficeManagementWorkspaceAction[];
  note?: string | null;
}): BackofficeManagementWorkspaceModel {
  const collection = getBackofficeSettingsCollectionById(params.collectionId);
  return {
    collection,
    title: params.title ?? collection.label,
    description: params.description ?? collection.description,
    routeKind: params.routeKind ?? collection.kind,
    signals: params.signals ?? [],
    primaryAction: params.primaryAction ?? null,
    secondaryActions: params.secondaryActions ?? [],
    relatedLinks: params.relatedLinks ?? [],
    note: params.note ?? null,
  };
}

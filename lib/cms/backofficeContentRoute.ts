import { BACKOFFICE_CONTENT_BASE_PATH } from "@/lib/cms/backofficeExtensionRegistry";
import type { ContentSectionWorkspaceViewId } from "@/lib/cms/backofficeWorkspaceContextModel";

export type BackofficeContentRouteKind =
  | "overview"
  | "detail"
  | "growth"
  | "recycle-bin";

export type BackofficeContentRouteState = {
  normalizedPathname: string;
  kind: BackofficeContentRouteKind;
  entityId: string | null;
  selectedNodeId: string | null;
  sectionView: ContentSectionWorkspaceViewId;
  isSectionView: boolean;
};

function normalizeContentPathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return BACKOFFICE_CONTENT_BASE_PATH;
  return trimmed.replace(/\/+$/, "") || BACKOFFICE_CONTENT_BASE_PATH;
}

export function resolveBackofficeContentRoute(pathname: string): BackofficeContentRouteState {
  const normalizedPathname = normalizeContentPathname(pathname);

  if (
    normalizedPathname === BACKOFFICE_CONTENT_BASE_PATH ||
    !normalizedPathname.startsWith(`${BACKOFFICE_CONTENT_BASE_PATH}/`)
  ) {
    return {
      normalizedPathname,
      kind: "overview",
      entityId: null,
      selectedNodeId: null,
      sectionView: "overview",
      isSectionView: true,
    };
  }

  const relative = normalizedPathname.slice(BACKOFFICE_CONTENT_BASE_PATH.length + 1);
  const firstSegment = relative.split("/")[0]?.trim() ?? "";

  if (firstSegment === "growth") {
    return {
      normalizedPathname,
      kind: "growth",
      entityId: null,
      selectedNodeId: null,
      sectionView: "growth",
      isSectionView: true,
    };
  }

  if (firstSegment === "recycle-bin") {
    return {
      normalizedPathname,
      kind: "recycle-bin",
      entityId: null,
      selectedNodeId: null,
      sectionView: "recycle-bin",
      isSectionView: true,
    };
  }

  return {
    normalizedPathname,
    kind: "detail",
    entityId: firstSegment || null,
    selectedNodeId: firstSegment || null,
    sectionView: "overview",
    isSectionView: false,
  };
}

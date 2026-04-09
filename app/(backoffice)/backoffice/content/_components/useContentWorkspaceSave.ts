/**
 * useContentWorkspaceSave — minimal consistency implementation.
 * The app’s current ContentWorkspace contains the real save logic inline,
 * but the repository still expects this module for shared types + pure invariants.
 */

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "offline" | "conflict" | "error";

export type ContentPage = {
  id: string;
  title: string;
  slug: string;
  body: unknown;
  status: "draft" | "published";
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};

export type LoadSuccessPayload = {
  page: ContentPage;
  nextTitle: string;
  nextSlug: string;
  snapshotBody: string | Record<string, unknown>;
  updated_at: string | null;
};

export type AutosaveDecisionParams = {
  dirty: boolean;
  pageNotFound: boolean;
  selectedId: string;
  detailLoading: boolean;
  hasConflict: boolean;
  isOffline: boolean;
  page: ContentPage | null;
  detailError: string | null;
  saveState: SaveState;
  skipNext: boolean;
};

/**
 * One-way save state machine:
 * - Matches `tests/cms/useContentWorkspaceSave.test.ts` invariants.
 * - For untested transitions, we stay fail-closed (keep current state).
 */
export function nextSaveState(current: SaveState, next: SaveState): SaveState {
  if (current === next) return current;

  switch (current) {
    case "idle":
      return next === "dirty" || next === "offline" ? next : "idle";
    case "saving":
      return next === "saved" || next === "conflict" || next === "error" || next === "offline" ? next : "saving";
    case "saved":
      return next === "dirty" || next === "idle" ? next : "saved";
    case "conflict":
      return next === "idle" ? next : "conflict";
    case "dirty":
      return next === "saving" || next === "offline" ? next : "dirty";
    case "offline":
      return next === "idle" || next === "dirty" ? next : "offline";
    case "error":
      return next === "saving" || next === "offline" ? next : "error";
    default:
      return current;
  }
}

export function shouldScheduleAutosave(params: AutosaveDecisionParams): boolean {
  const {
    dirty,
    pageNotFound,
    selectedId,
    detailLoading,
    hasConflict,
    isOffline,
    page,
    detailError,
    saveState,
    skipNext,
  } = params;

  if (!dirty) return false;
  if (pageNotFound) return false;
  if (!selectedId) return false;
  if (!page) return false;
  if (detailLoading) return false;
  if (hasConflict) return false;
  if (isOffline) return false;
  if (detailError) return false;
  if (saveState !== "idle" && saveState !== "saved") return false;
  if (skipNext) return false;
  return true;
}


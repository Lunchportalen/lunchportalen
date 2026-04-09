"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

type SectionSidebarContent = { key: string; node: ReactNode } | null;

/**
 * Tynne UI-actions og adaptere for ContentWorkspace — åpne offentlig side, pending navigasjon.
 * Ingen domene-/save-/preview-logikk.
 */

export function useContentWorkspaceOpenPublicPage(publicSlug: string | null) {
  return useCallback(() => {
    if (!publicSlug) return;
    if (typeof window === "undefined") return;
    const path = `/${publicSlug}`;
    window.open(path, "_blank", "noopener,noreferrer");
  }, [publicSlug]);
}

export function useContentWorkspacePendingNavigationActions(
  pendingNavigationHref: string | null,
  setPendingNavigationHref: (v: string | null) => void,
  clearAutosaveTimer: () => void,
  router: AppRouterInstance,
) {
  const cancelPendingNavigation = useCallback(() => setPendingNavigationHref(null), [setPendingNavigationHref]);

  const confirmPendingNavigation = useCallback(() => {
    const href = pendingNavigationHref;
    if (!href) return;
    setPendingNavigationHref(null);
    clearAutosaveTimer();
    router.push(href);
  }, [pendingNavigationHref, clearAutosaveTimer, router, setPendingNavigationHref]);

  return { cancelPendingNavigation, confirmPendingNavigation };
}

/** Plasserer tomt side-rail-slot i section layout — ren UI-binding. */
export function useContentWorkspaceSectionRailPlacement(
  setSectionSidebarContent: ((content: SectionSidebarContent) => void) | null,
  effectiveId: string | null | undefined,
) {
  useEffect(() => {
    if (!setSectionSidebarContent) return;

    if (!effectiveId) {
      setSectionSidebarContent({ key: "editor-rail-empty", node: null });
      return;
    }

    setSectionSidebarContent({
      key: `editor-rail:${effectiveId}:workspace-panels`,
      node: null,
    });
  }, [setSectionSidebarContent, effectiveId]);
}

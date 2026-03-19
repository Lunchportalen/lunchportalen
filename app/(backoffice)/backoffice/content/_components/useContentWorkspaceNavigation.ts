/**
 * Selection and navigation state for ContentWorkspace sidebar and page switching.
 * Owns: queryInput/query (debounced), mainView, hjemExpanded, onSelectPage.
 * Does not own: page/setPage, selectedId (from props), guardedPush (injected via ref).
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { MutableRefObject } from "react";
import { safeStr } from "./contentWorkspace.helpers";
import { useMainView } from "../_workspace/MainViewContext";

export type MainView = "page" | "global" | "design";

export type UseContentWorkspaceNavigationParams = {
  /** Current page id from URL (e.g. initialPageId). */
  selectedId: string;
  /** Loaded page id (page?.id) for isSamePage check. */
  pageId: string | undefined;
  /** Ref set by ContentWorkspace to guardedPush so hook can navigate without depending on save. */
  navigateRef: MutableRefObject<(href: string) => void>;
};

const DEBOUNCE_MS = 180;

export function useContentWorkspaceNavigation({
  selectedId,
  pageId,
  navigateRef,
}: UseContentWorkspaceNavigationParams) {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const { mainView, setMainView } = useMainView();
  const [hjemExpanded, setHjemExpanded] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(safeStr(queryInput)), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const onSelectPage = useCallback(
    (nextId: string, _slugForUrl?: string) => {
      setMainView("page");
      const isSamePage = !nextId || nextId === pageId || nextId === selectedId;
      if (isSamePage) return;
      const navigate = navigateRef.current;
      if (typeof navigate === "function") {
        navigate(`/backoffice/content/${nextId}`);
      }
    },
    [selectedId, pageId, navigateRef, setMainView]
  );

  return {
    queryInput,
    setQueryInput,
    query,
    mainView,
    setMainView,
    hjemExpanded,
    setHjemExpanded,
    onSelectPage,
  };
}

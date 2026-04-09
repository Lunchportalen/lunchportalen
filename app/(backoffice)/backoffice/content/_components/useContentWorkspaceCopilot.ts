"use client";

/**
 * Copilot-rail: fokus-blokk, forslag, debounced fetch, apply/dismiss.
 * Transport: `fetchPublicAiPostJson` i `contentWorkspace.aiRequests.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { debounce } from "@/lib/ai/debounce";
import type { CopilotSuggestion } from "./EditorCopilotRail";
import { fetchPublicAiPostJson } from "./contentWorkspace.aiRequests";
import type { UseContentWorkspacePanelRequestsParams } from "./contentWorkspace.panelAi.types";

function isCopilotBlockForFetch(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const t = String((raw as { type?: string }).type ?? "");
  return t === "richText" || t === "hero" || t === "cta";
}

function copilotFingerprintBlocks(blocks: unknown[], pageTitle: string): string {
  const parts = blocks.map((raw) => {
    if (!raw || typeof raw !== "object") return "";
    const b = raw as Record<string, unknown>;
    const id = String(b.id ?? "");
    const body = typeof b.body === "string" ? b.body.slice(0, 200) : "";
    const tit = typeof b.title === "string" ? b.title.slice(0, 120) : "";
    const heading = typeof b.heading === "string" ? b.heading.slice(0, 120) : "";
    const sub = typeof b.subtitle === "string" ? b.subtitle.slice(0, 120) : "";
    return `${id}:${tit}:${heading}:${sub}:${body.length}:${body.slice(0, 80)}`;
  });
  return `${pageTitle}\0${parts.join("\n")}`;
}

export type UseContentWorkspaceCopilotParams = Pick<
  UseContentWorkspacePanelRequestsParams,
  | "effectiveId"
  | "showBlocks"
  | "isContentTab"
  | "selectedBlockId"
  | "setSelectedBlockId"
  | "title"
  | "displayBlocks"
>;

export function useContentWorkspaceCopilot(p: UseContentWorkspaceCopilotParams) {
  const {
    effectiveId,
    showBlocks,
    isContentTab,
    selectedBlockId,
    setSelectedBlockId,
    title,
    displayBlocks,
  } = p;

  const [copilotDismissedIds, setCopilotDismissedIds] = useState<string[]>([]);
  const [copilotSuggestions, setCopilotSuggestions] = useState<CopilotSuggestion[]>([]);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const copilotAbortRef = useRef<AbortController | null>(null);
  const copilotFetchRef = useRef<(() => Promise<void>) | null>(null);
  const copilotDebouncedRef = useRef(
    debounce(() => {
      void copilotFetchRef.current?.();
    }, 420),
  );

  const copilotEnabled = Boolean(showBlocks && isContentTab && effectiveId);

  const fetchCopilot = useCallback(async () => {
    if (!copilotEnabled) return;
    const focus = selectedBlockId;
    if (
      !focus ||
      !displayBlocks.some(
        (b) => isCopilotBlockForFetch(b) && String((b as { id?: string }).id) === focus,
      )
    ) {
      setCopilotSuggestions([]);
      setCopilotBusy(false);
      return;
    }

    copilotAbortRef.current?.abort();
    const ac = new AbortController();
    copilotAbortRef.current = ac;
    setCopilotBusy(true);
    setCopilotError(null);

    try {
      const { ok: httpOk, json } = await fetchPublicAiPostJson(
        "/api/ai/copilot",
        {
          content: { title, blocks: displayBlocks },
          context: { focusBlockId: focus },
        },
        { signal: ac.signal },
      );
      const body = json as {
        ok?: boolean;
        data?: { suggestions?: CopilotSuggestion[] };
        error?: string;
      };
      if (!httpOk || body.ok === false) {
        setCopilotSuggestions([]);
        setCopilotError(typeof body.error === "string" ? body.error : "Copilot feilet");
        return;
      }
      const list = Array.isArray(body.data?.suggestions) ? body.data!.suggestions! : [];
      setCopilotSuggestions(list);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setCopilotSuggestions([]);
      setCopilotError("Copilot nettverksfeil");
    } finally {
      setCopilotBusy(false);
    }
  }, [copilotEnabled, selectedBlockId, title, displayBlocks]);

  copilotFetchRef.current = fetchCopilot;

  const copilotFp = useMemo(
    () => copilotFingerprintBlocks(displayBlocks, title),
    [displayBlocks, title],
  );

  useEffect(() => {
    if (!copilotEnabled) {
      setCopilotSuggestions([]);
      setCopilotError(null);
      return;
    }
    copilotDebouncedRef.current();
  }, [copilotEnabled, selectedBlockId, copilotFp]);

  useEffect(() => {
    return () => {
      copilotAbortRef.current?.abort();
    };
  }, []);

  const visibleCopilotSuggestions = useMemo(
    () => copilotSuggestions.filter((s) => !copilotDismissedIds.includes(s.id)),
    [copilotSuggestions, copilotDismissedIds],
  );

  const onCopilotApply = useCallback(
    (s: CopilotSuggestion) => {
      const id = s.targetBlockId ?? selectedBlockId;
      if (!id) return;
      setSelectedBlockId(id);
    },
    [selectedBlockId, setSelectedBlockId],
  );

  const onCopilotDismiss = useCallback((id: string) => {
    setCopilotDismissedIds((d) => (d.includes(id) ? d : [...d, id]));
  }, []);

  useEffect(() => {
    setCopilotDismissedIds([]);
  }, [selectedBlockId]);

  return {
    copilotBusy,
    copilotError,
    visibleCopilotSuggestions,
    onCopilotApply,
    onCopilotDismiss,
  };
}

/**
 * Loader callback factories for ContentWorkspace.
 * Builds onPageLoaded, onReset, onPageError, onDetailLoadStart from setters so refs can stay in ContentWorkspace.
 */

import type React from "react";
import type { PageLoadedData, PageErrorPayload } from "./ContentWorkspaceState";
import type { BodyParseResult } from "./contentWorkspace.blocks";
import type { LoadSuccessPayload } from "./useContentWorkspaceSave";
import { logEditorAiEvent } from "@/domain/backoffice/ai/metrics/logEditorAiEvent";

export type OnPageLoadedParams = {
  setDocumentTypeAlias: (v: string | null) => void;
  setInvariantEnvelopeFields: (v: Record<string, unknown>) => void;
  setCultureEnvelopeFields: (v: Record<string, unknown>) => void;
  setTitle: (v: string) => void;
  setSlug: (v: string) => void;
  setSlugTouched: (v: boolean) => void;
  applyParsedBody: (parsed: BodyParseResult) => void;
  applyLoadSuccess: (payload: LoadSuccessPayload) => void;
};

export function createOnPageLoaded(params: OnPageLoadedParams): (data: PageLoadedData) => void {
  const {
    setDocumentTypeAlias,
    setInvariantEnvelopeFields,
    setCultureEnvelopeFields,
    setTitle,
    setSlug,
    setSlugTouched,
    applyParsedBody,
    applyLoadSuccess,
  } = params;
  return (data: PageLoadedData) => {
    setDocumentTypeAlias(data.envelope.documentType);
    setInvariantEnvelopeFields(data.envelope.invariantFields);
    setCultureEnvelopeFields(data.envelope.cultureFields);
    setTitle(data.nextTitle);
    setSlug(data.nextSlug);
    setSlugTouched(false);
    applyParsedBody(data.parsedBody);
    applyLoadSuccess({
      page: data.page,
      nextTitle: data.nextTitle,
      nextSlug: data.nextSlug,
      snapshotBody: data.snapshotBody,
      updated_at: data.updated_at,
    });
  };
}

export type OnResetParams = {
  setTitle: (v: string) => void;
  setSlug: (v: string) => void;
  setSlugTouched: (v: boolean) => void;
  setBodyMode: (v: "blocks" | "legacy") => void;
  setBlocks: React.Dispatch<React.SetStateAction<unknown[]>>;
  setMeta: (v: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void;
  setLegacyBodyText: (v: string) => void;
  setInvalidBodyRaw: (v: string) => void;
  setBodyParseError: (v: string | null) => void;
  setSelectedBlockId: (v: string | null) => void;
  clearSaveStateForReset: () => void;
};

export function createOnReset(params: OnResetParams): () => void {
  const {
    setTitle,
    setSlug,
    setSlugTouched,
    setBodyMode,
    setBlocks,
    setMeta,
    setLegacyBodyText,
    setInvalidBodyRaw,
    setBodyParseError,
    setSelectedBlockId,
    clearSaveStateForReset,
  } = params;
  return () => {
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setBodyMode("blocks");
    setBlocks([]);
    setMeta({});
    setLegacyBodyText("");
    setInvalidBodyRaw("");
    setBodyParseError(null);
    setSelectedBlockId(null);
    clearSaveStateForReset();
  };
}

export type OnPageErrorParams = {
  clearSaveStateOnLoadError: () => void;
  selectedId: string;
};

export function createOnPageError(params: OnPageErrorParams): (payload: PageErrorPayload) => void {
  const { clearSaveStateOnLoadError, selectedId } = params;
  return (payload: PageErrorPayload) => {
    clearSaveStateOnLoadError();
    if (payload.message != null && selectedId) {
      logEditorAiEvent({
        type: "content_error",
        pageId: selectedId,
        timestamp: new Date().toISOString(),
        message: payload.message,
        kind: payload.isParseLike === true ? "parse" : "load",
      });
    }
  };
}

/** detailLoadStart is just the clearSaveStateOnLoadStart function. */
export function createDetailLoadStart(clearSaveStateOnLoadStart: () => void): () => void {
  return clearSaveStateOnLoadStart;
}

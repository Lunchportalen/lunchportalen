/**
 * Ref contract for async page detail load (list/detail hook ↔ shell).
 * Updated every render via useLayoutEffect so in-flight fetch always sees latest handlers.
 */

import type { BodyParseResult } from "./contentWorkspace.blocks";
import type { ContentPage } from "./ContentWorkspaceState";

export type ParsedEnvelopeForLoad = {
  documentType: string | null;
  fields: Record<string, unknown>;
  invariantFields: Record<string, unknown>;
  cultureFields: Record<string, unknown>;
  blocksBody: unknown;
};

export type ContentWorkspaceDetailLoadRef = {
  clearWorkspaceWhenNoPage: () => void;
  onBeforeDetailFetch: () => void;
  applyLoadedPage: (args: {
    page: ContentPage;
    nextTitle: string;
    nextSlug: string;
    envelope: ParsedEnvelopeForLoad;
    parsedBody: BodyParseResult;
    /** Same shape as editor `bodyForSave`: blocks JSON string or envelope object. */
    snapshotBody: string | Record<string, unknown>;
  }) => void;
  applyNotFound: () => void;
  applyLoadError: (message: string) => void;
};

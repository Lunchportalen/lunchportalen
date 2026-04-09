// STATUS: KEEP

/**
 * Shared state types for ContentWorkspace.
 * Single source for page/list/create and UI state shapes used across shell, panels, and loader.
 */

import type { PageStatus } from "./contentTypes";
import type { BodyParseResult } from "./contentWorkspace.blocks";

/** Payload after GET detail succeeds — shared by loader callbacks and persistence tests. */
export type PageLoadedData = {
  page: ContentPage;
  nextTitle: string;
  nextSlug: string;
  envelope: {
    documentType: string | null;
    /** Flattenet union (kompat). */
    fields: Record<string, unknown>;
    invariantFields: Record<string, unknown>;
    cultureFields: Record<string, unknown>;
    blocksBody: unknown;
  };
  parsedBody: BodyParseResult;
  snapshotBody: string | Record<string, unknown>;
  updated_at: string | null;
};

export type PageErrorPayload = {
  message?: string;
  isParseLike?: boolean;
};

export type ContentPageListItem = {
  id: string;
  title: string;
  slug: string;
  status: PageStatus;
  updated_at: string | null;
};

export type ContentPage = {
  id: string;
  title: string;
  slug: string;
  body: unknown;
  status: PageStatus;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  /** Set when detail loaded; used for check-release and release state visibility. */
  variantId?: string | null;
};

export type ListData = {
  items: ContentPageListItem[];
};

export type CreateData = {
  page: {
    id: string;
    title: string;
    slug: string;
    status: PageStatus;
  };
};

export type PageData = {
  page: ContentPage;
};

/** Media health probe status for editor status line. */
export type MediaHealthStatus = "idle" | "checking" | "available" | "unavailable";

/** Content health derived from selectedId + detail loading/error. */
export type ContentHealthStatus = "idle" | "checking" | "available" | "unavailable";

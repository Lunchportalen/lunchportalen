/**
 * Shared state types for ContentWorkspace.
 * Single source for page/list/create and UI state shapes used across shell, panels, and loader.
 */

import type { PageStatus } from "./contentTypes";

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

/**
 * Phase 32 Media: shared types for media_items (images only).
 */

export type MediaItemType = "image";

export type MediaItemStatus = "proposed" | "ready" | "failed";

export type MediaItemSource = "upload" | "ai";

export type MediaItem = {
  id: string;
  type: MediaItemType;
  status: MediaItemStatus;
  source: MediaItemSource;
  url: string;
  alt: string;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  mime_type?: string | null;
  bytes?: number | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_by?: string | null;
  created_at: string;
};
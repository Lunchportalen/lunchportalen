/**
 * Phase 32 Media: shared types for media_items (images only).
 * Enterprise CMS: metadata may include usageHint for editorial hints.
 *
 * Metadata for rendering:
 * - url (required): single reference for img src.
 * - alt (required in type; may be ""): accessibility; use safeAltForImg at render time.
 * - caption (optional): display under image; use safeCaptionForFigcaption at render time.
 */

export type MediaItemType = "image";

export type MediaItemStatus = "proposed" | "ready" | "failed";

export type MediaItemSource = "upload" | "ai";

/** Optional hint for where the image is typically used (stored in metadata.usageHint). */
export type MediaUsageHint = "hero" | "thumbnail" | "og" | "inline" | "banner";

export type MediaItemMetadata = {
  usageHint?: MediaUsageHint;
  /** Short editorial name for library lists (not alt text). */
  displayName?: string;
  /** Optional responsive or derivative URLs: key → absolute https URL (e.g. w640, og). */
  variants?: Record<string, string>;
  [key: string]: unknown;
};

/** Canonical media item shape. id is UUID from media_items.id (stable). url is the single reference field for rendering. */
export type MediaItem = {
  /** Stable UUID from DB; never use URL or path as id. */
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
  metadata: MediaItemMetadata;
  created_by?: string | null;
  created_at: string;
};
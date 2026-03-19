/**
 * Media truth: single place to turn a DB row into a canonical MediaItem.
 * Used by API routes and server loaders. Deterministic; no UI-only state.
 */

import type { MediaItem, MediaItemMetadata } from "./types";

const MEDIA_ITEM_SELECT =
  "id, type, status, source, url, alt, caption, width, height, mime_type, bytes, tags, metadata, created_by, created_at";

export const mediaItemSelectColumns = MEDIA_ITEM_SELECT;

function safeStr(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

function safeTags(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((t): t is string => typeof t === "string");
}

function safeMetadata(v: unknown): MediaItemMetadata {
  if (v == null || typeof v !== "object" || Array.isArray(v)) return {};
  return v as MediaItemMetadata;
}

/**
 * Normalize a media_items row to the canonical MediaItem shape.
 * Returns null if row is missing required id or url (deterministic: no guesswork).
 */
export function rowToMediaItem(row: Record<string, unknown> | null | undefined): MediaItem | null {
  if (!row || typeof row !== "object") return null;
  const id = safeStr(row.id);
  const url = safeStr(row.url);
  if (!id || !url) return null;
  const type = row.type === "image" ? "image" : "image";
  const status =
    row.status === "proposed" || row.status === "ready" || row.status === "failed"
      ? row.status
      : "ready";
  const source = row.source === "upload" || row.source === "ai" ? row.source : "upload";
  const alt = safeStr(row.alt);
  const captionRaw = row.caption;
  const caption =
    captionRaw == null ? null : typeof captionRaw === "string" ? captionRaw.trim() || null : null;
  const width =
    typeof row.width === "number" && Number.isFinite(row.width) ? row.width : null;
  const height =
    typeof row.height === "number" && Number.isFinite(row.height) ? row.height : null;
  const mime_type =
    typeof row.mime_type === "string" && row.mime_type.trim() ? row.mime_type.trim() : null;
  const bytes =
    typeof row.bytes === "number" && Number.isFinite(row.bytes)
      ? row.bytes
      : typeof row.bytes === "bigint"
        ? Number(row.bytes)
        : null;
  const tags = safeTags(row.tags);
  const metadata = safeMetadata(row.metadata);
  const created_by =
    typeof row.created_by === "string" && row.created_by.trim() ? row.created_by.trim() : null;
  const created_at = typeof row.created_at === "string" ? row.created_at : new Date().toISOString();

  return {
    id,
    type,
    status,
    source,
    url,
    alt,
    caption,
    width,
    height,
    mime_type,
    bytes,
    tags,
    metadata,
    created_by,
    created_at,
  };
}

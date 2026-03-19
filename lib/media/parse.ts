/**
 * Client-side parsing of media API responses.
 * Ensures id is never derived from url (single source of truth: id from API only).
 */

import type { MediaItem } from "./types";
import { isValidMediaItemId } from "./ids";

/**
 * Parse one raw item from API (list or single). Returns null if id or url missing/invalid.
 * Never uses url as id. Use for media library and picker so UI never has ambiguous id.
 */
export function parseMediaItemFromApi(raw: Record<string, unknown> | null | undefined): MediaItem | null {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id;
  if (!isValidMediaItemId(id)) return null;
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (!url) return null;

  const type = raw.type === "image" ? "image" : "image";
  const status =
    raw.status === "proposed" || raw.status === "ready" || raw.status === "failed"
      ? raw.status
      : "ready";
  const source = raw.source === "upload" || raw.source === "ai" ? raw.source : "upload";
  const alt = typeof raw.alt === "string" ? raw.alt.trim() : "";
  const captionRaw = raw.caption;
  const caption =
    captionRaw == null ? null : typeof captionRaw === "string" ? captionRaw.trim() || null : null;
  const width =
    typeof raw.width === "number" && Number.isFinite(raw.width) ? raw.width : null;
  const height =
    typeof raw.height === "number" && Number.isFinite(raw.height) ? raw.height : null;
  const mime_type =
    typeof raw.mime_type === "string" && raw.mime_type.trim() ? raw.mime_type.trim() : null;
  const bytes =
    typeof raw.bytes === "number" && Number.isFinite(raw.bytes)
      ? raw.bytes
      : null;
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : [];
  const metadata =
    raw.metadata != null && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  const created_by =
    typeof raw.created_by === "string" && raw.created_by.trim() ? raw.created_by.trim() : null;
  const created_at =
    typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString();

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

/**
 * Parse API list response into MediaItem[]. Skips entries with invalid or missing id/url.
 */
export function parseMediaItemListFromApi(data: unknown): MediaItem[] {
  let rawItems: unknown[];
  if (Array.isArray(data)) {
    rawItems = data;
  } else if (data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)) {
    rawItems = (data as { items: unknown[] }).items;
  } else {
    rawItems = [];
  }
  const out: MediaItem[] = [];
  for (const raw of rawItems) {
    const item = parseMediaItemFromApi(raw as Record<string, unknown>);
    if (item) out.push(item);
  }
  return out;
}

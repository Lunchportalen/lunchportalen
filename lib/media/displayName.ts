import type { MediaItem } from "./types";

const MAX_LEN = 120;

/**
 * Editorial label for lists/cards: metadata.displayName → caption → first tag → short id.
 */
export function getMediaDisplayName(item: MediaItem): string {
  const meta = item.metadata;
  const dn =
    meta && typeof meta === "object" && !Array.isArray(meta) && typeof (meta as { displayName?: unknown }).displayName === "string"
      ? String((meta as { displayName: string }).displayName).trim()
      : "";
  if (dn) return dn.slice(0, MAX_LEN);
  if (item.caption && String(item.caption).trim()) return String(item.caption).trim().slice(0, MAX_LEN);
  if (Array.isArray(item.tags) && item.tags.length > 0 && typeof item.tags[0] === "string" && item.tags[0].trim()) {
    return item.tags[0].trim().slice(0, MAX_LEN);
  }
  return `Bilde ${item.id.slice(0, 8)}…`;
}

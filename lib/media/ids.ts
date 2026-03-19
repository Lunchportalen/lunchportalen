/**
 * Media identifiers: stable id rules and validation.
 * - DB primary key is UUID; use isMediaItemUuid for route/loader validation.
 * - Blocks store mediaItemId; use isValidMediaItemId so URL/path is never stored as id.
 */

/**
 * UUID pattern used by media_items.id.
 * DB uses gen_random_uuid() which yields RFC4122 UUIDs, but for API safety and tests we only
 * require a generic 8-4-4-4-12 hex shape here (same as content page id validator).
 */
const MEDIA_ITEM_UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * True if id is a valid media_items UUID (for API path params and DB lookup).
 */
export function isMediaItemUuid(id: unknown): id is string {
  return typeof id === "string" && MEDIA_ITEM_UUID_REGEX.test(id.trim());
}

/**
 * True if id is safe to use as mediaItemId in content blocks.
 * Rejects URLs and paths so we never persist url-as-id (single source of truth: id from API).
 */
export function isValidMediaItemId(id: unknown): id is string {
  if (id == null || typeof id !== "string") return false;
  const t = id.trim();
  if (!t) return false;
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/")) return false;
  return true;
}

/**
 * Single source for extracting block list from CMS body.
 * Used by public [slug], backoffice preview [id], and any path that needs
 * to feed normalizeBlockForRender + renderBlock (same pipeline as public).
 */

export type BlockItem = { id?: string; type?: string; data?: Record<string, unknown> };

/**
 * Extracts blocks array from raw body (object with .blocks, or array, or nested .body).
 * Returns empty array when body is null/undefined or has no blocks.
 */
export function parseBody(body: unknown): BlockItem[] {
  if (body == null) return [];
  if (Array.isArray(body)) return body as BlockItem[];
  if (
    typeof body === "object" &&
    "blocks" in body &&
    Array.isArray((body as { blocks: unknown }).blocks)
  ) {
    return (body as { blocks: BlockItem[] }).blocks;
  }
  if (typeof body === "object" && "body" in body) {
    return parseBody((body as { body: unknown }).body);
  }
  return [];
}

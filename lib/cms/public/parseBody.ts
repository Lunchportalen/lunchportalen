/**
 * Single source for extracting block list from CMS body.
 * Used by public [slug], backoffice preview [id], and any path that needs
 * to feed normalizeBlockForRender + renderBlock (same pipeline as public).
 */

import type { BlockConfig } from "@/lib/cms/design/designContract";
import { extractBlocksSource } from "@/lib/cms/extractBlocksSource";

export type BlockItem = {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
  config?: BlockConfig;
};

/**
 * Extracts canonical blocks array from raw body.
 * Supports flat `{ blocks }`, legacy nested `.body`, and envelope payloads with `blocksBody.blocks`.
 */
export function parseBody(body: unknown): BlockItem[] {
  if (body == null) return [];
  if (Array.isArray(body)) return body as BlockItem[];
  const source = extractBlocksSource(body);
  if (Array.isArray(source)) return source as BlockItem[];
  if (typeof body === "object" && "body" in body) {
    return parseBody((body as { body: unknown }).body);
  }
  return [];
}

/**
 * Extracts `meta` from canonical `{ blocks, meta }` body (or nested `.body` envelope).
 * Returns empty object when absent — never throws.
 */
export function parseBodyMeta(body: unknown): Record<string, unknown> {
  if (body == null) return {};
  if (typeof body === "object" && !Array.isArray(body) && "body" in body) {
    return parseBodyMeta((body as { body: unknown }).body);
  }
  if (typeof body === "object" && !Array.isArray(body) && "meta" in body) {
    const m = (body as { meta: unknown }).meta;
    if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, unknown>;
  }
  return {};
}

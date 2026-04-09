/**
 * Live public page content: `content_pages` (published) + `content_page_variants` (locale `nb`, environment `prod` or `preview`).
 * Same data path as header/footer global reads — DB is source of truth; publish promotes preview → prod in backoffice.
 */
import "server-only";

import type { ContentBySlugResult, GetContentBySlugOptions } from "./getContentBySlug";
import { getContentBySlug } from "./getContentBySlug";
import type { BlockItem } from "./parseBody";
import { parseBody, parseBodyMeta } from "./parseBody";

export type LivePublicPage = {
  pageId: string;
  slug: string;
  title: string | null;
  body: unknown;
  /** Parsed from `{ blocks, meta }` — page/section CMS design overlays (Phase 2A). */
  meta: Record<string, unknown>;
  blocks: BlockItem[];
  experimentAssignment: ContentBySlugResult["experimentAssignment"];
};

/**
 * Resolve published (or preview) page body and parsed blocks for public rendering.
 * Returns `null` when no published page or no matching variant (fail-closed).
 */
export async function loadLivePageContent(
  slug: string,
  options?: GetContentBySlugOptions,
): Promise<LivePublicPage | null> {
  const row = await getContentBySlug(slug, options);
  if (!row) return null;
  const blocks = parseBody(row.body);
  const meta = parseBodyMeta(row.body);
  return {
    pageId: row.pageId,
    slug: row.slug,
    title: row.title,
    body: row.body,
    meta,
    blocks: Array.isArray(blocks) ? blocks : [],
    experimentAssignment: row.experimentAssignment ?? null,
  };
}

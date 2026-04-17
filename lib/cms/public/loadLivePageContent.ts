/**
 * Live public page content for marketing routes: {@link getContentBySlug} → Umbraco Delivery (allowlisted slugs) or local harness.
 * Public marketing truth is **not** Supabase editorial rows; those are backoffice/internal readers only.
 */
import "server-only";

import type {
  ContentBySlugResult,
  GetContentBySlugOptions,
  PublicContentRuntimeOrigin,
} from "./getContentBySlug";
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
  /** Where this page body came from at runtime (live source or seed). */
  publicContentOrigin: PublicContentRuntimeOrigin;
  experimentAssignment: ContentBySlugResult["experimentAssignment"];
};

/**
 * Resolve page body and parsed blocks for public rendering.
 * Returns `null` when Delivery misses or slug is not allowlisted (fail-closed before seed overlay).
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
    publicContentOrigin: row.publicContentOrigin,
    experimentAssignment: row.experimentAssignment ?? null,
  };
}

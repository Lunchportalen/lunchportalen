/**
 * Public CMS pages (Umbraco allowlisted slugs) with deterministic empty seed when Delivery misses or returns no blocks.
 * Same render path as `loadLivePageContent` → `CmsBlockRenderer`.
 */
import "server-only";

import type { GetContentBySlugOptions } from "./getContentBySlug";
import { parseBody, parseBodyMeta } from "./parseBody";
import type { LivePublicPage } from "./loadLivePageContent";
import { loadLivePageContent } from "./loadLivePageContent";
import { isPublicUmbracoEditorialFallbackSlug } from "@/lib/cms/umbraco/marketingAdapter";
import { buildEditorialFallbackPublicBody } from "@/lib/cms/seed/editorialFallbackHomeBody";

export async function loadPublicPageWithTrustFallback(
  slug: string,
  options?: GetContentBySlugOptions,
): Promise<LivePublicPage | null> {
  const normalized = slug.trim().toLowerCase();
  if (!normalized) return null;

  const live = await loadLivePageContent(normalized, options);
  if (live && live.blocks.length > 0) return live;

  /**
   * Slug `home`: seed only when canonical source has no usable blocks.
   * - `seed-marketing-home` — no row from {@link getContentBySlug} (Umbraco/local harness miss; Supabase is not used for allowlisted `home`).
   * - `seed-marketing-home-empty-body` — row exists but body parses to zero blocks (editorial gap; not hidden as "live").
   */
  if (normalized === "home") {
    const seedList = buildEditorialFallbackPublicBody();
    const body = seedList;
    const blocks = parseBody(body);
    const meta = parseBodyMeta(body);
    const noSourceRow = live == null;
    const pageId = noSourceRow ? "seed-marketing-home" : "seed-marketing-home-empty-body";
    const publicContentOrigin = noSourceRow ? "seed-no-row" : "seed-empty-body";
    return {
      pageId,
      slug: "home",
      title: live?.title ?? null,
      body,
      meta,
      blocks: Array.isArray(blocks) ? blocks : [],
      publicContentOrigin,
      experimentAssignment: live?.experimentAssignment ?? null,
    };
  }

  if (!isPublicUmbracoEditorialFallbackSlug(normalized)) return live;

  const body = buildEditorialFallbackPublicBody();
  const blocks = parseBody(body);
  const meta = parseBodyMeta(body);
  const noSourceRow = live == null;
  const pageId = noSourceRow ? `seed-umbraco-${normalized}-no-row` : `seed-umbraco-${normalized}-empty-body`;
  const publicContentOrigin = noSourceRow ? "seed-no-row" : "seed-empty-body";

  return {
    pageId,
    slug: normalized,
    title: live?.title ?? null,
    body,
    meta,
    blocks: Array.isArray(blocks) ? blocks : [],
    publicContentOrigin,
    experimentAssignment: live?.experimentAssignment ?? null,
  };
}

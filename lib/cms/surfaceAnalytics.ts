// STATUS: KEEP

import type { CmsSurface } from "@/lib/cms/surfaces";

/** Standard keys inside `content_analytics_events` metadata JSON (public analytics API). */
export type CmsSurfaceAnalyticsMetadata = {
  cms_surface?: CmsSurface;
  cms_block_id?: string;
  cms_variant_id?: string;
  /** impression | interaction | conversion — align with product analytics naming */
  cms_engagement?: "impression" | "interaction" | "conversion";
};

export function buildSurfaceAnalyticsMetadata(input: CmsSurfaceAnalyticsMetadata): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.cms_surface) out.cms_surface = input.cms_surface;
  if (input.cms_block_id) out.cms_block_id = input.cms_block_id;
  if (input.cms_variant_id) out.cms_variant_id = input.cms_variant_id;
  if (input.cms_engagement) out.cms_engagement = input.cms_engagement;
  return out;
}

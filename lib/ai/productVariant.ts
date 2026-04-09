import type { CmsSurface } from "@/lib/cms/surfaces";

/**
 * Product-level variant record for AI + experiments (not identical to DB `content_page_variants` rows).
 * Use for suggestions, dashboards, and cross-surface learning keys.
 */
export type CmsFeatureSnapshot = {
  ctaCount?: number;
  heroPresent?: boolean;
  trustHits?: number;
  primaryCopyLen?: number;
  /** Surface-specific tags (e.g. experiment id, block types present) */
  tags?: string[];
};

export type ProductVariant = {
  surface: CmsSurface;
  block_id: string;
  /** Serialized primary copy or JSON snippet for the targeted block */
  content: string;
  features: CmsFeatureSnapshot;
};

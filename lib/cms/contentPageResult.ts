/**
 * Shared types for published CMS page resolution (Supabase editorial + historical public-origin labels).
 * Kept separate from slug-fetch implementations so internal readers do not depend on removed marketing resolvers.
 */

/**
 * Resolved live source label before seed overlay (public marketing resolver removed).
 */
export type PublicContentLiveOrigin = "live-umbraco" | "live-supabase" | "local-cms" | "local-reserve";

/** Full runtime label for DOM / verification: live sources + deterministic seeds. */
export type PublicContentRuntimeOrigin =
  | PublicContentLiveOrigin
  | "seed-no-row"
  | "seed-empty-body";

export type ContentBySlugResult = {
  pageId: string;
  slug: string;
  title: string | null;
  body: unknown;
  /** Which live source supplied this row (legacy / diagnostic). */
  publicContentOrigin: PublicContentLiveOrigin;
  /** Present when a running traffic experiment assigned a variant for this request. */
  experimentAssignment?: { experimentId: string; variantId: string } | null;
};

/**
 * `preview: true` loads `content_page_variants.environment = 'preview'`.
 * No silent fallback to prod when the preview variant is missing.
 */
export type GetContentBySlugOptions = {
  preview?: boolean;
  /** Override stable subject for deterministic A/B (else derived from request headers when possible). */
  experimentSubjectKey?: string | null;
  /** When true, 50/50 random between first two variants (logged); otherwise deterministic assignment. */
  experimentUseRandomSplit?: boolean;
};

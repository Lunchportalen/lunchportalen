/**
 * Page AI Contract — single source of truth for AI/SEO/CRO fields at page level.
 * Stored in content_page_variants.body.meta (same envelope as blocks).
 * Used by: improve page, SEO optimize, page builder, diagnostics, CRO tooling.
 * Do not duplicate these field names elsewhere; extend here if new fields are needed.
 */

export type PageAiSeo = {
  /** Primary SEO title (e.g. <title>, og:title when not overridden). */
  title?: string;
  /** Meta description. */
  description?: string;
  /** Canonical URL when different from default (path or full URL). */
  canonical?: string;
  /** Legacy alias; prefer canonical. */
  canonicalUrl?: string;
  /** When true, emit robots noindex. */
  noIndex?: boolean;
  /** When true, emit robots nofollow. */
  noFollow?: boolean;
  /** OG/Twitter image path or URL (e.g. /images/og.jpg). */
  ogImage?: string;
};

export type PageAiSocial = {
  /** og:title / twitter:title override. */
  title?: string;
  /** og:description / twitter:description override. */
  description?: string;
};

export type PageAiIntent = {
  /** Short intent (e.g. "inform", "convert", "signup"). */
  intent?: string;
  /** Target audience (e.g. "bedriftskunder", "HR"). */
  audience?: string;
  /** Primary keyword. */
  primaryKeyword?: string;
  /** Secondary keywords (array). */
  secondaryKeywords?: string[];
  /** Content goals (array). */
  contentGoals?: string[];
  /** Brand tone (e.g. "rolig", "profesjonell"). */
  brandTone?: string;
};

/** CRO: CTAs, trust, scannability. Optional; extend when CRO tooling is added. */
export type PageAiCro = {
  /** Primary CTA copy or placement hint. */
  primaryCta?: string;
  /** Trust signals to emphasize. */
  trustSignals?: string[];
  /** Scannability / structure hint. */
  scannability?: string;
};

/** Diagnostics and suggestions from last AI run (improve/SEO/builder). Not versioned history. */
export type PageAiDiagnostics = {
  /** Last run timestamp (ISO). */
  lastRun?: string;
  /** Short diagnostic messages. */
  diagnostics?: string[];
  /** Suggested improvements. */
  suggestions?: string[];
};

/**
 * Full page-level AI/SEO/CRO meta. All fields optional; presence indicates use.
 * body.meta should conform to this shape where AI/SEO/CRO tools read/write.
 */
export type PageAiContract = {
  seo?: PageAiSeo;
  social?: PageAiSocial;
  intent?: PageAiIntent;
  cro?: PageAiCro;
  diagnostics?: PageAiDiagnostics;
};

/** Keys under body.meta that belong to this contract. Use for pick/merge, not for exhaustive storage. */
export const PAGE_AI_META_KEYS = [
  "seo",
  "social",
  "intent",
  "cro",
  "diagnostics",
] as const;

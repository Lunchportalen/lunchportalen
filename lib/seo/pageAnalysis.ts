/**
 * Deterministic page-analysis engine for AI SEO.
 * Single extraction layer: normalizes blocks + meta into structured SEO signals.
 * Used by SEO Intelligence and SEO Optimize tool. Malformed content never throws.
 */

export type PageSeoAnalysis = {
  /** SEO title (meta.seo.title or pageTitle fallback). */
  title: string;
  /** Meta description (meta.seo.description). */
  description: string;
  /** Headings in document order (richText heading/title). */
  headings: string[];
  /** First heading text, or empty if none. */
  firstHeading: string;
  /** Concatenated body text from richText blocks (space-separated). */
  bodyContent: string;
  /** Approximate word count of bodyContent. */
  bodyWordCount: number;
  /** Whether any richText body contains internal link patterns. */
  hasInternalLinks: boolean;
  /** Number of internal link patterns found across bodies. */
  internalLinkCount: number;
  /** Image/hero alt signals: block id, alt text, and whether it was missing or empty. */
  imageAlts: Array<{ blockId: string; alt: string; empty: boolean }>;
  /** Whether page has a FAQ-style block (heading "Spørsmål og svar" or "FAQ"). */
  hasFaq: boolean;
  /** Whether page has at least one CTA block. */
  hasCta: boolean;
  /** First CTA block button label, or empty. */
  ctaButtonLabel: string;
  /** First CTA block title, or empty. */
  ctaTitle: string;
  /** Block count used in analysis (capped). */
  blocksAnalyzed: number;
};

export type PageSeoAnalysisInput = {
  blocks: unknown;
  meta?: unknown;
  pageTitle?: string | null;
};

const MAX_BLOCKS = 100;
// Match markdown links: ](/path) or ](https://...)
const INTERNAL_LINK_REGEX = /\]\((\/[^)]*|https?:\/\/[^)]+)\)/g;
const HREF_PATTERN = "href=";

function safeStr(v: unknown): string {
  if (v == null) return "";
  return (typeof v === "string" ? v : String(v)).trim();
}

function normalizeBlocks(raw: unknown): Array<{ id: string; type: string; data?: Record<string, unknown> }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_BLOCKS)
    .filter((b): b is Record<string, unknown> => b != null && typeof b === "object" && !Array.isArray(b))
    .filter((b) => typeof b.id === "string" && typeof b.type === "string")
    .map((b) => ({
      id: String(b.id),
      type: String(b.type).trim(),
      data:
        b.data != null && typeof b.data === "object" && !Array.isArray(b.data)
          ? (b.data as Record<string, unknown>)
          : undefined,
    }));
}

function countInternalLinks(body: string): number {
  if (typeof body !== "string" || !body) return 0;
  const match = body.match(INTERNAL_LINK_REGEX);
  const fromRegex = match ? match.length : 0;
  const fromHref = body.includes(HREF_PATTERN) ? 1 : 0;
  return fromRegex + (fromHref > 0 && fromRegex === 0 ? 1 : 0);
}

/**
 * Extract structured SEO signals from page blocks and meta.
 * Safe: malformed or missing input yields empty strings, zero counts, false flags.
 */
export function analyzePageForSeo(input: PageSeoAnalysisInput): PageSeoAnalysis {
  const blocks = normalizeBlocks(input.blocks);
  const meta = input.meta != null && typeof input.meta === "object" && !Array.isArray(input.meta)
    ? (input.meta as Record<string, unknown>)
    : {};
  const seo =
    meta.seo != null && typeof meta.seo === "object" && !Array.isArray(meta.seo)
      ? (meta.seo as Record<string, unknown>)
      : {};
  const pageTitle = input.pageTitle != null ? safeStr(input.pageTitle) : "";
  // Support flat meta (e.g. from inputMetaToAiContext) for description/title
  const flatDesc = typeof meta.description === "string" ? safeStr(meta.description) : "";
  const flatTitle = typeof meta.title === "string" ? safeStr(meta.title) : "";

  const title = safeStr(seo.title) || flatTitle || pageTitle;
  const description = safeStr(seo.description) || flatDesc;

  const headings: string[] = [];
  const bodyParts: string[] = [];
  let hasInternalLinks = false;
  let internalLinkCount = 0;
  const imageAlts: Array<{ blockId: string; alt: string; empty: boolean }> = [];
  let hasFaq = false;
  let hasCta = false;
  let ctaButtonLabel = "";
  let ctaTitle = "";

  const faqHeadings = ["spørsmål og svar", "faq"];

  for (const b of blocks) {
    const data = b.data ?? {};
    const blockType = b.type || "";

    if (blockType === "richText") {
      const heading = data.heading ?? data.title;
      const hStr = safeStr(heading);
      if (hStr) headings.push(hStr);
      const body = typeof data.body === "string" ? data.body : "";
      if (body) {
        bodyParts.push(body);
        const n = countInternalLinks(body);
        if (n > 0) {
          hasInternalLinks = true;
          internalLinkCount += n;
        }
      }
      if (hStr && faqHeadings.includes(hStr.toLowerCase())) hasFaq = true;
    }

    if (blockType === "image") {
      const alt = safeStr(data.alt);
      imageAlts.push({ blockId: b.id, alt, empty: !alt });
    }

    if (blockType === "hero") {
      const imageAlt = safeStr(data.imageAlt);
      imageAlts.push({ blockId: b.id, alt: imageAlt, empty: !imageAlt });
    }

    if (blockType === "cta" && !hasCta) {
      hasCta = true;
      ctaButtonLabel = safeStr(data.buttonLabel);
      ctaTitle = safeStr(data.title);
    }
  }

  const bodyContent = bodyParts.join(" ");
  const bodyWordCount = bodyContent ? bodyContent.split(/\s+/).filter(Boolean).length : 0;
  const firstHeading = headings.length > 0 ? headings[0] : "";

  return {
    title,
    description,
    headings,
    firstHeading,
    bodyContent,
    bodyWordCount,
    hasInternalLinks,
    internalLinkCount,
    imageAlts,
    hasFaq,
    hasCta,
    ctaButtonLabel,
    ctaTitle,
    blocksAnalyzed: blocks.length,
  };
}

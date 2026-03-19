/**
 * AI CONTEXT ENGINE
 * AI må forstå systemet, ikke bare tekst. Denne modulen samler:
 * - sideinnhold (page)
 * - struktur (site/nav + block-struktur)
 * - SEO-data
 * - analytics
 * - intern linking
 * - CMS schema
 * Brukerdata samles i contextBuilder (bruker buildContext). Ingen eksterne API-kall; alle kilder sendes inn.
 * Dette er det som gjør AI smart i kontekst.
 */

import type { BlockNode } from "@/lib/cms/model/blockTypes";
import type { PageAiSeo } from "@/lib/cms/model/pageAiContract";

/** Page content source: blocks array or BlockList-like. */
export type PageContentSource =
  | { blocks: BlockNode[]; meta?: Record<string, unknown> }
  | { version: 1; blocks: BlockNode[]; meta?: Record<string, unknown> }
  | BlockNode[];

/** Schema source: allowed block types or generic schema shape. */
export type SchemaSource = {
  blockTypes?: string[];
  [key: string]: unknown;
} | null | undefined;

/** SEO source: full PageAiSeo or partial (title, description, etc.). */
export type SeoFieldsSource = Partial<PageAiSeo> | null | undefined;

/** Analytics signals source: pre-aggregated counts and top lists. */
export type AnalyticsSignalsSource = {
  pageViews7d?: number | null;
  pageViews30d?: number | null;
  ctaClicks7d?: number | null;
  ctaClicks30d?: number | null;
  ctaTop?: Array<{ key: string; count: number }> | null;
  searchCount7d?: number | null;
  searchCount30d?: number | null;
  [key: string]: unknown;
} | null | undefined;

/** Internal linking source: incoming/outgoing links for current page. */
export type InternalLinksSource = {
  /** Links from other pages to this page (path, optional anchor, optional count). */
  incoming?: Array<{ path: string; anchor?: string | null; count?: number | null }> | null;
  /** Links from this page to others (path, optional label). */
  outgoing?: Array<{ path: string; label?: string | null }> | null;
  /** Same-page anchor targets (e.g. #section). */
  samePageAnchors?: string[] | null;
  [key: string]: unknown;
} | null | undefined;

/** Site structure source: pages and nav for structure-aware AI. */
export type StructureSource = {
  /** Current pages (path, title, optional purpose). */
  currentPages?: Array<{ path: string; title?: string | null; purpose?: string | null }> | null;
  /** Primary nav (path, label). */
  currentNav?: Array<{ path: string; label?: string | null }> | null;
  [key: string]: unknown;
} | null | undefined;

/** Input to buildContext: all sources optional. */
export type BuildContextInput = {
  pageContent?: PageContentSource | null;
  schema?: SchemaSource;
  seoFields?: SeoFieldsSource;
  analyticsSignals?: AnalyticsSignalsSource;
  internalLinks?: InternalLinksSource;
  structure?: StructureSource;
  /** Optional traceability (locale, pageId, variantId). */
  locale?: string | null;
  pageId?: string | null;
  variantId?: string | null;
};

/** Normalized page slice in context. */
export type NormalizedPageContext = {
  blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  blockCount: number;
  blockTypes: string[];
  meta?: Record<string, unknown>;
};

/** Normalized schema slice. */
export type NormalizedSchemaContext = {
  allowedBlockTypes: string[];
  [key: string]: unknown;
};

/** Normalized SEO slice. */
export type NormalizedSeoContext = {
  title?: string;
  description?: string;
  canonical?: string;
  noIndex?: boolean;
  noFollow?: boolean;
  ogImage?: string;
};

/** Normalized analytics slice. */
export type NormalizedAnalyticsContext = {
  pageViews7d?: number;
  pageViews30d?: number;
  ctaClicks7d?: number;
  ctaClicks30d?: number;
  ctaTop: Array<{ key: string; count: number }>;
  searchCount7d?: number;
  searchCount30d?: number;
};

/** Normalized internal links slice. */
export type NormalizedInternalLinksContext = {
  incoming: Array<{ path: string; anchor?: string; count?: number }>;
  outgoing: Array<{ path: string; label?: string }>;
  samePageAnchors: string[];
};

/** Normalized structure slice (site/nav). */
export type NormalizedStructureContext = {
  currentPages: Array<{ path: string; title: string; purpose?: string }>;
  currentNav: Array<{ path: string; label: string }>;
};

/** Normalized AI context returned by buildContext. */
export type NormalizedAiContext = {
  page: NormalizedPageContext;
  schema: NormalizedSchemaContext;
  seo: NormalizedSeoContext;
  analytics: NormalizedAnalyticsContext;
  internalLinks: NormalizedInternalLinksContext;
  structure: NormalizedStructureContext;
  locale?: string;
  pageId?: string;
  variantId?: string;
};

function normalizeBlocks(source: PageContentSource): BlockNode[] {
  if (Array.isArray(source)) {
    return source;
  }
  const blocks = "blocks" in source ? source.blocks : [];
  return Array.isArray(blocks) ? blocks : [];
}

function toBlockNode(raw: unknown): BlockNode | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.trim() : String(o.id ?? "");
  const type = typeof o.type === "string" ? o.type.trim() : String(o.type ?? "");
  if (!id || !type) return null;
  const data = o.data != null && typeof o.data === "object" && !Array.isArray(o.data)
    ? (o.data as Record<string, unknown>)
    : undefined;
  return { id, type, data };
}

function normalizePageContent(input: PageContentSource | null | undefined): NormalizedPageContext {
  const blocksRaw = input != null ? normalizeBlocks(input) : [];
  const blocks: BlockNode[] = [];
  for (const b of blocksRaw) {
    const node = toBlockNode(b);
    if (node) blocks.push(node);
  }
  const blockTypes = [...new Set(blocks.map((b) => b.type).filter(Boolean))];
  const meta =
    input != null &&
    !Array.isArray(input) &&
    "meta" in input &&
    input.meta &&
    typeof input.meta === "object" &&
    !Array.isArray(input.meta)
      ? (input.meta as Record<string, unknown>)
      : undefined;

  return {
    blocks,
    blockCount: blocks.length,
    blockTypes,
    ...(meta && Object.keys(meta).length > 0 && { meta }),
  };
}

function normalizeSchema(input: SchemaSource): NormalizedSchemaContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { allowedBlockTypes: [] };
  }
  const o = input as Record<string, unknown>;
  const blockTypes = o.blockTypes;
  const allowedBlockTypes = Array.isArray(blockTypes)
    ? (blockTypes as unknown[]).filter((t): t is string => typeof t === "string").map((t) => t.trim()).filter(Boolean)
    : [];
  return {
    ...o,
    allowedBlockTypes,
  };
}

function safeStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = typeof v === "string" ? v.trim() : String(v).trim();
  return s || undefined;
}

function safeNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function normalizeSeo(input: SeoFieldsSource): NormalizedSeoContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const o = input as Record<string, unknown>;
  const title = safeStr(o.title);
  const description = safeStr(o.description);
  const canonical = safeStr(o.canonical) ?? safeStr(o.canonicalUrl);
  const noIndex = o.noIndex === true;
  const noFollow = o.noFollow === true;
  const ogImage = safeStr(o.ogImage);

  const out: NormalizedSeoContext = {};
  if (title !== undefined) out.title = title;
  if (description !== undefined) out.description = description;
  if (canonical !== undefined) out.canonical = canonical;
  if (noIndex) out.noIndex = true;
  if (noFollow) out.noFollow = true;
  if (ogImage !== undefined) out.ogImage = ogImage;
  return out;
}

function normalizeAnalytics(input: AnalyticsSignalsSource): NormalizedAnalyticsContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ctaTop: [] };
  }
  const o = input as Record<string, unknown>;
  const pageViews7d = safeNum(o.pageViews7d);
  const pageViews30d = safeNum(o.pageViews30d);
  const ctaClicks7d = safeNum(o.ctaClicks7d);
  const ctaClicks30d = safeNum(o.ctaClicks30d);
  const searchCount7d = safeNum(o.searchCount7d);
  const searchCount30d = safeNum(o.searchCount30d);

  const ctaTop: Array<{ key: string; count: number }> = [];
  const raw = o.ctaTop;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const key = typeof (item as Record<string, unknown>).key === "string"
          ? (item as Record<string, unknown>).key as string
          : String((item as Record<string, unknown>).key ?? "");
        const count = safeNum((item as Record<string, unknown>).count);
        if (key && count !== undefined && count >= 0) {
          ctaTop.push({ key, count });
        }
      }
    }
  }

  const out: NormalizedAnalyticsContext = { ctaTop };
  if (pageViews7d !== undefined) out.pageViews7d = pageViews7d;
  if (pageViews30d !== undefined) out.pageViews30d = pageViews30d;
  if (ctaClicks7d !== undefined) out.ctaClicks7d = ctaClicks7d;
  if (ctaClicks30d !== undefined) out.ctaClicks30d = ctaClicks30d;
  if (searchCount7d !== undefined) out.searchCount7d = searchCount7d;
  if (searchCount30d !== undefined) out.searchCount30d = searchCount30d;
  return out;
}

function normalizeInternalLinks(input: InternalLinksSource): NormalizedInternalLinksContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { incoming: [], outgoing: [], samePageAnchors: [] };
  }
  const o = input as Record<string, unknown>;
  const incoming: NormalizedInternalLinksContext["incoming"] = [];
  const rawIn = o.incoming;
  if (Array.isArray(rawIn)) {
    for (const item of rawIn) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const path = safeStr((item as Record<string, unknown>).path);
        if (path) {
          const anchor = safeStr((item as Record<string, unknown>).anchor);
          const count = safeNum((item as Record<string, unknown>).count);
          incoming.push({ path, ...(anchor && { anchor }), ...(count !== undefined && { count }) });
        }
      }
    }
  }
  const outgoing: NormalizedInternalLinksContext["outgoing"] = [];
  const rawOut = o.outgoing;
  if (Array.isArray(rawOut)) {
    for (const item of rawOut) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const path = safeStr((item as Record<string, unknown>).path);
        if (path) {
          const label = safeStr((item as Record<string, unknown>).label);
          outgoing.push({ path, ...(label && { label }) });
        }
      }
    }
  }
  const samePageAnchors: string[] = [];
  const rawAnchors = o.samePageAnchors;
  if (Array.isArray(rawAnchors)) {
    for (const a of rawAnchors) {
      const s = safeStr(a);
      if (s) samePageAnchors.push(s);
    }
  }
  return { incoming, outgoing, samePageAnchors };
}

function normalizeStructure(input: StructureSource): NormalizedStructureContext {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { currentPages: [], currentNav: [] };
  }
  const o = input as Record<string, unknown>;
  const currentPages: NormalizedStructureContext["currentPages"] = [];
  const rawPages = o.currentPages;
  if (Array.isArray(rawPages)) {
    for (const item of rawPages) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const path = safeStr((item as Record<string, unknown>).path);
        if (path) {
          const title = safeStr((item as Record<string, unknown>).title) ?? path;
          const purpose = safeStr((item as Record<string, unknown>).purpose);
          currentPages.push({ path, title, ...(purpose && { purpose }) });
        }
      }
    }
  }
  const currentNav: NormalizedStructureContext["currentNav"] = [];
  const rawNav = o.currentNav;
  if (Array.isArray(rawNav)) {
    for (const item of rawNav) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        const path = safeStr((item as Record<string, unknown>).path);
        if (path) {
          const label = safeStr((item as Record<string, unknown>).label) ?? path;
          currentNav.push({ path, label });
        }
      }
    }
  }
  return { currentPages, currentNav };
}

/**
 * Builds a normalized AI context from page content, structure, schema, SEO, analytics, and internal links.
 * No external API calls; all sources are optional and normalized to a single object.
 */
export function buildContext(input: BuildContextInput = {}): NormalizedAiContext {
  const page = normalizePageContent(input.pageContent ?? null);
  const schema = normalizeSchema(input.schema);
  const seo = normalizeSeo(input.seoFields);
  const analytics = normalizeAnalytics(input.analyticsSignals);
  const internalLinks = normalizeInternalLinks(input.internalLinks);
  const structure = normalizeStructure(input.structure);

  const out: NormalizedAiContext = {
    page,
    schema,
    seo,
    analytics,
    internalLinks,
    structure,
  };

  const locale = safeStr(input.locale);
  const pageId = safeStr(input.pageId);
  const variantId = safeStr(input.variantId);
  if (locale !== undefined) out.locale = locale;
  if (pageId !== undefined) out.pageId = pageId;
  if (variantId !== undefined) out.variantId = variantId;

  return out;
}

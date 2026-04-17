import type { ContentBySlugResult } from "@/lib/cms/public/getContentBySlug";
import { EDITORIAL_FAIL_CLOSED_DESCRIPTION } from "@/lib/cms/public/editorialFailClosedMetadata";
import type { JsonLdFaqItem } from "@/lib/seo/jsonld";
import { faqJsonLd, organizationJsonLd, webPageJsonLd } from "@/lib/seo/jsonld";
import { canonicalForPath, siteName } from "@/lib/seo/site";

function parseMetaFaq(body: unknown): JsonLdFaqItem[] {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return [];
  const root = body as Record<string, unknown>;
  const meta = root.meta;
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) return [];
  const m = meta as Record<string, unknown>;
  const raw = m.faq ?? m.faqs;
  if (!Array.isArray(raw)) return [];
  const out: JsonLdFaqItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const o = item as Record<string, unknown>;
    const q = typeof o.q === "string" ? o.q.trim() : typeof o.question === "string" ? o.question.trim() : "";
    const a = typeof o.a === "string" ? o.a.trim() : typeof o.answer === "string" ? o.answer.trim() : "";
    if (q && a) out.push({ q, a });
  }
  return out;
}

function isEditorialFallbackBody(body: unknown): boolean {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return false;
  const meta = (body as Record<string, unknown>).meta;
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) return false;
  const m = meta as Record<string, unknown>;
  return m.notEditorialLive === true || m.surface === "lp_editorial_fallback";
}

function seoDescriptionFromBody(body: unknown): string {
  if (body == null || typeof body !== "object" || Array.isArray(body)) return "";
  const meta = (body as Record<string, unknown>).meta;
  if (meta == null || typeof meta !== "object" || Array.isArray(meta)) return "";
  const seo = (meta as Record<string, unknown>).seo;
  if (seo == null || typeof seo !== "object" || Array.isArray(seo)) return "";
  const d = (seo as Record<string, unknown>).description;
  return typeof d === "string" ? d.trim() : "";
}

type Props = {
  page: Pick<ContentBySlugResult, "title" | "slug" | "body">;
};

/**
 * Deterministic JSON-LD graph for public editorial pages — same body object as blocks + metadata.
 * Safe for seed/fail-closed: uses technical description, never claims rich live marketing when fallback.
 */
export function buildPublicCmsJsonLdGraph(
  page: Pick<ContentBySlugResult, "title" | "slug" | "body">,
  canonicalPath: string,
): unknown[] {
  const pathNorm = canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`;
  const fallback = isEditorialFallbackBody(page.body);
  const name = (page.title && page.title.trim()) || siteName();
  const description = fallback
    ? EDITORIAL_FAIL_CLOSED_DESCRIPTION
    : seoDescriptionFromBody(page.body) || name;

  const faqItems = parseMetaFaq(page.body);
  const graph: unknown[] = [
    organizationJsonLd(),
    webPageJsonLd({
      url: canonicalForPath(pathNorm),
      name,
      description,
      inLanguage: "nb-NO",
    }),
  ];

  if (faqItems.length > 0) {
    try {
      graph.push(faqJsonLd(faqItems));
    } catch {
      // fail-closed: skip FAQ schema if invalid
    }
  }

  return graph;
}

export type PublicCmsStructuredDataProps = {
  page: Pick<ContentBySlugResult, "title" | "slug" | "body">;
  /** Canonical path e.g. `/` or `/om-oss` — must match metadata canonical. */
  canonicalPath: string;
};

/**
 * JSON-LD for any public CMS page (forside + marketing routes) — samme truth som body/metadata.
 */
export function PublicCmsStructuredData({ page, canonicalPath }: PublicCmsStructuredDataProps) {
  const graph = buildPublicCmsJsonLdGraph(page, canonicalPath);
  const idSuffix = (page.slug && page.slug.trim()) || "page";
  return (
    <script
      id={`jsonld-public-cms-${idSuffix.replace(/[^a-z0-9-]/gi, "-")}`}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}

/**
 * JSON-LD for forsiden (`/`) — canonical path er alltid `/`.
 */
export function CmsStructuredData({ page }: Props) {
  return <PublicCmsStructuredData page={page} canonicalPath="/" />;
}

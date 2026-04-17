/**
 * Pure mapping: Umbraco Content Delivery API item → legacy LP body `{ version, blocks, meta }`.
 * Kept framework-agnostic for unit tests (no fetch / env).
 */

export type UmbracoMappedMarketingContent = {
  pageId: string;
  slug: string;
  title: string | null;
  body: unknown;
  experimentAssignment: null;
};

/** Umbraco element type alias → LP block `type` consumed by parseBody / normalizeBlockForRender. */
export const UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE: Record<string, string> = {
  lpHero: "hero",
  lpRichText: "richText",
  lpImage: "image",
  lpCards: "cards",
  lpCta: "cta",
  accordionOrTab: "accordionOrTab",
  alertBox: "alertBox",
  anchorNavigation: "anchorNavigation",
  banners: "banners",
  codeBlock: "codeBlock",
  textBlock: "textBlock",
  heroBannerBlock: "heroBannerBlock",
  dualPromoCardsBlock: "dualPromoCardsBlock",
  /** First-class registry types (Delivery → same `type` as enterprise render contract). */
  sectionIntro: "section_intro",
  logoCloud: "logo_cloud",
  statsBlock: "stats_block",
  testimonialBlock: "testimonial_block",
  quoteBlock: "quote_block",
  newsletterSignup: "newsletter_signup",
  formEmbed: "form_embed",
};

const MARKETING_PAGE_TYPES = new Set([
  "marketingPage",
  "marketingpage",
  "lpMarketingPage",
  "homePage",
  "homepage",
  "contentPage",
  "contentpage",
  "contactPage",
  "contactpage",
  "legalPage",
  "legalpage",
  "landingPage",
  "landingpage",
]);

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

/**
 * Unwraps Delivery API property envelopes like `{ value: T }` (shallow + one nested value).
 */
export function unwrapDeliveryPropertyValue(v: unknown): unknown {
  if (!isPlainObject(v)) return v;
  if ("value" in v) {
    const inner = v.value;
    if (isPlainObject(inner) && "value" in inner) return (inner as { value: unknown }).value;
    return inner;
  }
  return v;
}

function unwrapPropertyBag(props: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(props)) {
    out[k] = unwrapDeliveryPropertyValue(raw);
  }
  return out;
}

/**
 * Block list from Delivery API v2 is typically `{ items: [ { content: { contentType, id, properties } } ] }`.
 * Older samples used `{ value: [ ... ] }` envelopes; both are supported.
 */
function extractBlockListItems(raw: unknown): unknown[] {
  const unwrapped = unwrapDeliveryPropertyValue(raw);
  if (Array.isArray(unwrapped)) return unwrapped;
  if (!isPlainObject(unwrapped)) return [];
  const o = unwrapped;
  if (Array.isArray(o.items)) return o.items;
  if (Array.isArray(o.value)) return o.value as unknown[];
  return [];
}

function blockContentFromListItem(item: unknown): Record<string, unknown> | null {
  if (!isPlainObject(item)) return null;
  const content = item.content;
  if (isPlainObject(content)) return content;
  return item;
}

/** Block List row `settings` element → flat bag (Delivery may nest under `properties`). */
function blockSettingsFromListItem(item: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(item)) return undefined;
  const s = item.settings;
  if (s == null || !isPlainObject(s)) return undefined;
  if (isPlainObject(s.properties)) {
    const bag = unwrapPropertyBag(s.properties as Record<string, unknown>);
    return Object.keys(bag).length ? bag : undefined;
  }
  const bag = unwrapPropertyBag(s as Record<string, unknown>);
  return Object.keys(bag).length ? bag : undefined;
}

function readBlockElementPropertyBag(element: Record<string, unknown>): Record<string, unknown> {
  if (isPlainObject(element.properties)) {
    return unwrapPropertyBag(element.properties as Record<string, unknown>);
  }
  const skip = new Set([
    "contentType",
    "contentTypeAlias",
    "alias",
    "id",
    "key",
    "name",
    "properties",
    "route",
    "cultures",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(element)) {
    if (skip.has(k)) continue;
    out[k] = unwrapDeliveryPropertyValue(v);
  }
  return out;
}

/** Normalizes nested Block List property values to `{ id, ...props }[]` for Delivery. */
function normalizeNestedBlockListProperty(raw: unknown, fallbackIdPrefix: string): Array<Record<string, unknown>> {
  const items = extractBlockListItems(raw);
  const out: Array<Record<string, unknown>> = [];
  let j = 0;
  for (const row of items) {
    const el = blockContentFromListItem(row);
    if (!el) continue;
    const itemProps = readBlockElementPropertyBag(el);
    const nid = safeStr(el.id) || safeStr(el.key) || `${fallbackIdPrefix}-${j}`;
    out.push({ id: nid, ...itemProps });
    j += 1;
  }
  return out;
}

function readPropertiesBag(root: Record<string, unknown>): Record<string, unknown> {
  const props = root.properties;
  if (isPlainObject(props)) return unwrapPropertyBag(props);
  return unwrapPropertyBag(root);
}

function normalizeElementAlias(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t.charAt(0).toLowerCase() + t.slice(1);
}

function mapElementToBlock(
  blockIndex: number,
  element: Record<string, unknown>,
  settingsBag?: Record<string, unknown>,
): { id: string; type: string; data: Record<string, unknown> } | null {
  const rawType =
    safeStr(element.contentType) ||
    safeStr(element.contentTypeAlias) ||
    safeStr((element as { alias?: unknown }).alias);
  const blockType = UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE[normalizeElementAlias(rawType)];
  if (!blockType) return null;

  const props = readBlockElementPropertyBag(element);

  const id =
    safeStr(element.id) ||
    safeStr(element.key) ||
    `umbraco-${blockType}-${blockIndex}`;

  const data: Record<string, unknown> = { ...props };

  if (settingsBag && Object.keys(settingsBag).length > 0) {
    data.umbracoSettings = settingsBag;
  }

  if (blockType === "accordionOrTab" && data.accordionItems != null) {
    data.accordionItems = normalizeNestedBlockListProperty(data.accordionItems, "accordion-item");
  }

  if (blockType === "anchorNavigation" && data.links != null) {
    data.links = normalizeNestedBlockListProperty(data.links, "anchor-link");
  }

  if (blockType === "banners" && data.bannerItems != null) {
    data.bannerItems = normalizeNestedBlockListProperty(data.bannerItems, "banner-item");
  }

  if (blockType === "heroBannerBlock") {
    if (data.quickLinks != null) {
      data.quickLinks = normalizeNestedBlockListProperty(data.quickLinks, "hero-quick-link");
    }
    if (data.sublineItems != null) {
      data.sublineItems = normalizeNestedBlockListProperty(data.sublineItems, "hero-subline");
    }
  }

  if (blockType === "dualPromoCardsBlock" && data.items != null) {
    data.items = normalizeNestedBlockListProperty(data.items, "promo-card");
  }

  if (blockType === "logo_cloud" && data.logos != null) {
    data.logos = normalizeNestedBlockListProperty(data.logos, "logo-item");
  }

  if (blockType === "stats_block" && data.kpis != null) {
    data.kpis = normalizeNestedBlockListProperty(data.kpis, "kpi-item");
  }

  if (blockType === "testimonial_block" && data.testimonials != null) {
    data.testimonials = normalizeNestedBlockListProperty(data.testimonials, "testimonial-item");
  }

  if (blockType === "cards" && typeof data.items === "string") {
    try {
      const parsed = JSON.parse(data.items) as unknown;
      if (Array.isArray(parsed)) data.items = parsed;
    } catch {
      data.items = [];
    }
  }
  if (blockType === "cards" && data.presentation == null) {
    data.presentation = "feature";
  }

  return { id, type: blockType, data };
}

export type MapDeliveryItemOptions = {
  /** Requested public slug (normalized lowercase). */
  slug: string;
};

/**
 * Maps a single Delivery API content item JSON to `ContentBySlugResult` with legacy-compatible `body`.
 */
export function mapUmbracoDeliveryItemToContentBySlugResult(
  item: unknown,
  options: MapDeliveryItemOptions,
): UmbracoMappedMarketingContent | null {
  if (!isPlainObject(item)) return null;
  const root = item;
  const ctype = safeStr(root.contentType).toLowerCase();
  if (ctype && !MARKETING_PAGE_TYPES.has(ctype)) return null;

  const props = readPropertiesBag(root);
  const pageId = safeStr(root.id) || safeStr(root.key);
  if (!pageId) return null;

  const title =
    safeStr(props.pageTitle) ||
    safeStr(props.title) ||
    safeStr(root.name) ||
    null;

  const routeSlug = (safeStr(props.routeSlug) || options.slug).toLowerCase();

  const blocksRaw = [
    ...extractBlockListItems(props.bodyBlocks ?? props.bodyblocks ?? props.blocks),
    ...extractBlockListItems(props.mainContent),
  ];
  const blocks: Array<{ id: string; type: string; data: Record<string, unknown> }> = [];
  let i = 0;
  for (const br of blocksRaw) {
    const el = blockContentFromListItem(br);
    if (!el) continue;
    const settings = blockSettingsFromListItem(br);
    const mapped = mapElementToBlock(i, el, settings);
    if (mapped) {
      blocks.push(mapped);
      i += 1;
    }
  }

  const seo: Record<string, unknown> = {};
  const social: Record<string, unknown> = {};

  const seoTitle = safeStr(props.seoTitle);
  const seoDescription = safeStr(props.seoDescription);
  const seoCanonical = safeStr(props.seoCanonical);
  const seoOgImage = safeStr(props.seoOgImage);
  if (seoTitle) seo.title = seoTitle;
  if (seoDescription) seo.description = seoDescription;
  if (seoCanonical) seo.canonical = seoCanonical;
  if (seoOgImage) seo.ogImage = seoOgImage;
  if (props.seoNoIndex === true) seo.noIndex = true;
  if (props.seoNoFollow === true) seo.noFollow = true;

  const socialTitle = safeStr(props.socialTitle);
  const socialDescription = safeStr(props.socialDescription);
  if (socialTitle) social.title = socialTitle;
  if (socialDescription) social.description = socialDescription;

  const meta: Record<string, unknown> = {};
  if (Object.keys(seo).length) meta.seo = seo;
  if (Object.keys(social).length) meta.social = social;

  const body: Record<string, unknown> = {
    version: 1,
    blocks,
  };
  if (Object.keys(meta).length) body.meta = meta;

  return {
    pageId,
    slug: routeSlug || options.slug,
    title,
    body,
    experimentAssignment: null,
  };
}

import faqData from "./faq-data.json";
import registryData from "./marketing-registry.json";

import { normalizePath } from "./site";

export type MarketingPageType = "website" | "article";
export type MarketingChangeFreq = "daily" | "weekly" | "monthly";

export type MarketingIntentLink = {
  href: string;
  label: string;
};

export type MarketingBreadcrumb = {
  name: string;
  item: string;
};

export type MarketingCta = {
  href: string;
  label: string;
};

export type MarketingPage = {
  path: string;
  title: string;
  description: string;
  pageType: MarketingPageType;
  ogImage: string;
  isIndexable: boolean;
  priority: number;
  changefreq: MarketingChangeFreq;
  lastmod?: "auto" | string;
  breadcrumbs: MarketingBreadcrumb[];
  intentLinks: MarketingIntentLink[];
  faqKey?: string;
  primaryCta?: MarketingCta;
  secondaryCta?: MarketingCta;
};

export type MarketingRegistry = Record<string, MarketingPage>;

const FORBIDDEN_ANCHORS = new Set(["les mer", "se mer", "klikk her"]);
const KEY_LANDING_PATHS = new Set([
  "/lunsjordning",
  "/hva-er-lunsjordning",
  "/definitiv-guide-firmalunsj",
  "/system-for-lunsjbestilling",
  "/lunch-levering-bergen",
]);
const CHANGEFREQ_SET = new Set<MarketingChangeFreq>(["daily", "weekly", "monthly"]);

export const MARKETING_REGISTRY: MarketingRegistry = registryData as MarketingRegistry;

function assertNonEmpty(value: string, code: string) {
  if (!String(value ?? "").trim()) {
    throw new Error(code);
  }
}

function isGenericAnchorLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase();
  return FORBIDDEN_ANCHORS.has(normalized) || normalized.startsWith("se ") || normalized.startsWith("les ");
}

function assertCta(path: string, cta: MarketingCta | undefined, kind: "primary" | "secondary") {
  if (!cta) {
    throw new Error(`SEO_REGISTRY_${kind.toUpperCase()}_CTA_MISSING:${path}`);
  }

  assertNonEmpty(cta.href, `SEO_REGISTRY_${kind.toUpperCase()}_CTA_HREF_MISSING:${path}`);
  assertNonEmpty(cta.label, `SEO_REGISTRY_${kind.toUpperCase()}_CTA_LABEL_MISSING:${path}`);

  if (!cta.href.startsWith("/")) {
    throw new Error(`SEO_REGISTRY_${kind.toUpperCase()}_CTA_HREF_INVALID:${path}:${cta.href}`);
  }

  if (isGenericAnchorLabel(cta.label)) {
    throw new Error(`SEO_REGISTRY_${kind.toUpperCase()}_CTA_LABEL_GENERIC:${path}:${cta.label}`);
  }
}

function assertIntentLinks(path: string, intentLinks: MarketingIntentLink[], registryKeys: ReadonlySet<string>) {
  if (!Array.isArray(intentLinks)) {
    throw new Error(`SEO_REGISTRY_INTENT_LINKS_INVALID:${path}`);
  }

  if (KEY_LANDING_PATHS.has(path) && intentLinks.length < 8) {
    throw new Error(`SEO_REGISTRY_INTENT_LINKS_TOO_FEW:${path}`);
  }

  const seen = new Set<string>();

  for (const link of intentLinks) {
    assertNonEmpty(link.href, `SEO_REGISTRY_INTENT_HREF_MISSING:${path}`);
    assertNonEmpty(link.label, `SEO_REGISTRY_INTENT_LABEL_MISSING:${path}`);

    if (!link.href.startsWith("/")) {
      throw new Error(`SEO_REGISTRY_INTENT_HREF_NOT_INTERNAL:${path}:${link.href}`);
    }

    const normalizedHref = normalizePath(link.href);

    if (normalizedHref === path) {
      throw new Error(`SEO_REGISTRY_INTENT_SELF_LINK:${path}`);
    }

    if (path !== "/" && normalizedHref === "/") {
      throw new Error(`SEO_REGISTRY_INTENT_INVALID_TARGET:${path}:${link.href}`);
    }

    if (!registryKeys.has(normalizedHref)) {
      throw new Error(`SEO_REGISTRY_INTENT_TARGET_MISSING:${path}:${link.href}`);
    }

    const normalizedLabel = link.label.trim().toLowerCase();
    if (isGenericAnchorLabel(link.label)) {
      throw new Error(`SEO_REGISTRY_INTENT_LABEL_GENERIC:${path}:${link.label}`);
    }

    const dedupe = `${link.href}::${normalizedLabel}`;
    if (seen.has(dedupe)) {
      throw new Error(`SEO_REGISTRY_INTENT_DUPLICATE:${path}:${dedupe}`);
    }

    seen.add(dedupe);
  }
}

function assertBreadcrumbs(path: string, breadcrumbs: MarketingBreadcrumb[]) {
  if (!Array.isArray(breadcrumbs) || breadcrumbs.length === 0) {
    throw new Error(`SEO_REGISTRY_BREADCRUMBS_EMPTY:${path}`);
  }

  for (const crumb of breadcrumbs) {
    assertNonEmpty(crumb.name, `SEO_REGISTRY_BREADCRUMB_NAME_MISSING:${path}`);
    assertNonEmpty(crumb.item, `SEO_REGISTRY_BREADCRUMB_ITEM_MISSING:${path}`);
    if (!crumb.item.startsWith("/")) {
      throw new Error(`SEO_REGISTRY_BREADCRUMB_ITEM_INVALID:${path}:${crumb.item}`);
    }
  }
}

function assertFaq(path: string, faqKey?: string) {
  if (!faqKey) return;

  if (faqKey !== path) {
    throw new Error(`SEO_REGISTRY_FAQKEY_MISMATCH:${path}:${faqKey}`);
  }

  const faqMap = faqData as Record<string, Array<{ q: string; a: string }>>;
  if (!Array.isArray(faqMap[faqKey])) {
    throw new Error(`SEO_REGISTRY_FAQKEY_NOT_FOUND:${path}`);
  }
}

function assertIsoDate(path: string, lastmod: string) {
  if (lastmod === "auto") return;

  const date = new Date(lastmod);
  if (Number.isNaN(date.valueOf())) {
    throw new Error(`SEO_REGISTRY_LASTMOD_INVALID:${path}:${lastmod}`);
  }
}

export function assertMarketingRegistry(registry: MarketingRegistry = MARKETING_REGISTRY): MarketingRegistry {
  const entries = Object.entries(registry);
  if (entries.length === 0) {
    throw new Error("SEO_REGISTRY_EMPTY");
  }
  const normalizedKeys = entries.map(([key]) => normalizePath(key));
  const registryKeys = Object.freeze(new Set(normalizedKeys)) as ReadonlySet<string>;

  for (const [key, entry] of entries) {
    const normalizedKey = normalizePath(key);
    const normalizedPath = normalizePath(entry.path);

    if (normalizedKey !== normalizedPath) {
      throw new Error(`SEO_REGISTRY_PATH_MISMATCH:${key}:${entry.path}`);
    }

    assertNonEmpty(entry.title, `SEO_REGISTRY_TITLE_MISSING:${key}`);
    assertNonEmpty(entry.description, `SEO_REGISTRY_DESCRIPTION_MISSING:${key}`);
    assertNonEmpty(entry.ogImage, `SEO_REGISTRY_OG_IMAGE_MISSING:${key}`);

    if (!entry.ogImage.startsWith("/og/")) {
      throw new Error(`SEO_REGISTRY_OG_IMAGE_INVALID:${key}:${entry.ogImage}`);
    }

    if (entry.priority < 0.1 || entry.priority > 1.0) {
      throw new Error(`SEO_REGISTRY_PRIORITY_INVALID:${key}:${entry.priority}`);
    }

    if (!CHANGEFREQ_SET.has(entry.changefreq)) {
      throw new Error(`SEO_REGISTRY_CHANGEFREQ_INVALID:${key}:${entry.changefreq}`);
    }

    assertIsoDate(normalizedPath, entry.lastmod || "auto");
    assertBreadcrumbs(normalizedPath, entry.breadcrumbs);
    assertIntentLinks(normalizedPath, entry.intentLinks, registryKeys);
    assertFaq(normalizedPath, entry.faqKey);

    if (KEY_LANDING_PATHS.has(normalizedPath)) {
      assertCta(normalizedPath, entry.primaryCta, "primary");
      assertCta(normalizedPath, entry.secondaryCta, "secondary");
    }
  }

  return registry;
}

export function getMarketingPage(path: string): MarketingPage {
  const normalized = normalizePath(path);
  const registry = assertMarketingRegistry();
  const entry = registry[normalized];
  if (!entry) {
    throw new Error(`SEO_REGISTRY_MISSING_FOR_PATH:${normalized}`);
  }
  return entry;
}

export function listMarketingPages(): MarketingPage[] {
  const registry = assertMarketingRegistry();
  return Object.values(registry).sort((a, b) => a.path.localeCompare(b.path));
}

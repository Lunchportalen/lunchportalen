/**
 * Local mock content tree (no API).
 * Umbraco-style: Home (root), Global, Design, Recycle Bin.
 * Editor uses getNodeById for workspace data.
 * ContentPage shape: 4 layers (global, layout, main, meta) + sequential render pipeline.
 */

/** Layout template variant for preview wrapper */
export type LayoutVariant = "full" | "left" | "right" | "centerNavLeft" | "centerNavRight";

/** Code block behaviour: run = inject HTML (scripts stripped in preview); display = show in <pre><code> */
export type CodeBlockBehaviour = "run" | "display";

export type ContentBlock = {
  id: string;
  type: string;
  [k: string]: unknown;
};

export type ExtraContentShape = {
  aboveMain: ContentBlock[];
  belowMain: ContentBlock[];
  pods: ContentBlock[];
  modals: {
    enabled: boolean;
    mode: "timed" | "scroll";
    openAfterSeconds: number;
    hideDays: number;
    contentRef?: string;
  };
};

export type MetaSummary = { heading?: string; secondaryHeading?: string; text?: string; image?: string };
export type MetaNavigation = {
  hideFromAllNavigation?: boolean;
  hideFromInternalSearch?: boolean;
  hideBreadcrumb?: boolean;
  subNavLabel?: string;
  htmlSitemapLabel?: string;
  breadcrumbLabel?: string;
  searchResultLabel?: string;
};
export type MetaSeoShare = {
  title?: string;
  description?: string;
  ogImage?: string;
  twitterCreator?: string;
  noindex?: boolean;
  nofollow?: boolean;
  sitemapPriority?: number;
  sitemapChangefreq?: string;
  canonicalOverride?: string;
  alternativeUrl?: string;
  alternativeName?: string;
};
export type MetaScripts = {
  headerOpening?: string;
  headerClosing?: string;
  afterBodyOpen?: string;
  beforeBodyClose?: string;
  disableGlobalScripts?: boolean;
};
export type MetaAdvanced = {
  languageName?: string;
  languageFlag?: string;
  hideHeaderSection?: boolean;
  hideFooterSection?: boolean;
  overrideDesignStyleRef?: string;
  overrideLogoRef?: string;
  contentDirection?: "ltr" | "rtl";
  customPageClasses?: string;
  disableDelete?: boolean;
};

export type ContentPageMeta = {
  summary?: MetaSummary;
  navigation?: MetaNavigation;
  seoShare?: MetaSeoShare;
  scripts?: MetaScripts;
  advanced?: MetaAdvanced;
};

/** Front-end ContentPage model (used by editor + preview) */
export type ContentPageModel = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "published";
  updatedAt?: string;
  publishedAt?: string;
  globalRef?: string;
  layoutVariant?: LayoutVariant;
  hidePageHeadings?: boolean;
  mainContent: ContentBlock[];
  extraContent?: ExtraContentShape;
  meta?: ContentPageMeta;
};

export type MockContentNode = {
  id: string;
  name: string;
  type: "root" | "folder" | "page" | "recycle";
  slug?: string;
  docType?: "home" | "global" | "design" | "page";
  blocks?: unknown[];
  children?: MockContentNode[];
  /** Umbraco-like content model (optional; when set, editor uses this) */
  globalRef?: string;
  layoutVariant?: LayoutVariant;
  hidePageHeadings?: boolean;
  mainContent?: ContentBlock[];
  extraContent?: ExtraContentShape;
  meta?: ContentPageMeta;
  status?: "draft" | "published";
  updatedAt?: string;
  publishedAt?: string;
};

const DEFAULT_EXTRA: ExtraContentShape = {
  aboveMain: [],
  belowMain: [],
  pods: [],
  modals: { enabled: false, mode: "timed", openAfterSeconds: 6, hideDays: 14 },
};

const DEFAULT_META: ContentPageMeta = {
  summary: {},
  navigation: {},
  seoShare: { sitemapPriority: 0.5, sitemapChangefreq: "weekly" },
  scripts: {},
  advanced: { contentDirection: "ltr" },
};

export const MOCK_ROOT: MockContentNode = {
  id: "home",
  name: "Hjem",
  type: "root",
  slug: "/",
  docType: "home",
  blocks: [],
  globalRef: "global",
  layoutVariant: "full",
  hidePageHeadings: false,
  mainContent: [],
  extraContent: DEFAULT_EXTRA,
  meta: {
    ...DEFAULT_META,
    advanced: { ...DEFAULT_META.advanced, disableDelete: true },
  },
  status: "draft",
  children: [
    {
      id: "global",
      name: "Global",
      type: "folder",
      docType: "global",
      children: [
        { id: "global-header", name: "Header", type: "page", docType: "page", slug: "header", blocks: [], children: [] },
        { id: "global-footer", name: "Footer", type: "page", docType: "page", slug: "footer", blocks: [], children: [] },
      ],
    },
    {
      id: "design",
      name: "Design",
      type: "folder",
      docType: "design",
      children: [
        { id: "design-tokens", name: "Design tokens", type: "page", docType: "page", slug: "design-tokens", blocks: [], children: [] },
      ],
    },
  ],
};

/** Recycle bin is a special route /recycle-bin, not under Home. */
export const MOCK_RECYCLE_BIN_ID = "recycle-bin";

export function getNodeById(root: MockContentNode, id: string): MockContentNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const found = getNodeById(child, id);
    if (found) return found;
  }
  return null;
}

/** Map tree node to editor ContentPage model (mainContent = mainContent ?? blocks) */
export function toContentPageModel(node: MockContentNode): ContentPageModel {
  const main = node.mainContent ?? (Array.isArray(node.blocks) ? (node.blocks as ContentBlock[]) : []);
  return {
    id: node.id,
    title: node.name,
    slug: node.slug ?? "",
    status: node.status ?? "draft",
    updatedAt: node.updatedAt,
    publishedAt: node.publishedAt,
    globalRef: node.globalRef,
    layoutVariant: node.layoutVariant ?? "full",
    hidePageHeadings: node.hidePageHeadings ?? false,
    mainContent: main,
    extraContent: node.extraContent ?? DEFAULT_EXTRA,
    meta: node.meta ?? DEFAULT_META,
  };
}

export function flattenNodes(node: MockContentNode, level = 0): { node: MockContentNode; level: number }[] {
  const out: { node: MockContentNode; level: number }[] = [{ node, level }];
  for (const child of node.children ?? []) {
    out.push(...flattenNodes(child, level + 1));
  }
  return out;
}

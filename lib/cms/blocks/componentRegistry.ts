/**
 * Hard-locked AI + page-builder component registry (see {@link CORE_COMPONENT_KEYS} for count).
 * Field kinds: text | textarea | media | link | select (variant enum).
 *
 * Sync: {@link CORE_COMPONENT_KEYS} in `componentGroups.ts` must list exactly these keys.
 */

import { CORE_COMPONENT_KEYS } from "@/lib/cms/blocks/componentGroups";

export type RegistryScalarKind = "text" | "textarea" | "media" | "link";

/** Scalar kind, or enum list (select). */
export type RegistryFieldDef = RegistryScalarKind | readonly string[];

export const VARIANT_SELECT = ["left", "right", "center", "minimal"] as const;

const V = VARIANT_SELECT;

function L(label: string, fields: Record<string, RegistryFieldDef>) {
  return { label, fields } as const;
}

export const COMPONENT_REGISTRY = {
  hero_bleed: L("Hero (fullbleed)", {
    title: "text",
    subtitle: "textarea",
    backgroundImage: "media",
    ctaPrimary: "text",
    ctaPrimaryHref: "link",
    variant: V,
  }),
  hero_split: L("Hero (splitt)", {
    title: "text",
    subtitle: "textarea",
    image: "media",
    ctaLabel: "text",
    ctaHref: "link",
    variant: V,
  }),
  hero_minimal: L("Hero (minimal)", {
    title: "text",
    subtitle: "textarea",
    ctaLabel: "text",
    ctaHref: "link",
    variant: V,
  }),
  hero_centered: L("Hero (sentrert)", {
    title: "text",
    subtitle: "textarea",
    backgroundImage: "media",
    ctaLabel: "text",
    ctaHref: "link",
    variant: V,
  }),
  hero_video: L("Hero (video)", {
    title: "text",
    subtitle: "textarea",
    video: "media",
    poster: "media",
    ctaLabel: "text",
    ctaHref: "link",
    variant: V,
  }),

  banner: L("Banner", {
    text: "text",
    backgroundImage: "media",
    ctaLabel: "text",
    ctaHref: "link",
    variant: V,
  }),
  /** Multi-slide marketing strip (Umbraco `banners` + nested `bannerItem` rows). */
  banner_carousel: L("Bannerkarusell", {
    slidesJson: "textarea",
    autoRotateMs: "text",
    showArrows: "text",
    showDots: "text",
    disableCarousel: "text",
    variant: V,
  }),
  promo_strip: L("Promostripe", {
    text: "text",
    ctaLabel: "text",
    ctaHref: "link",
    accentImage: "media",
    variant: V,
  }),
  cta_block: L("CTA", {
    title: "text",
    body: "textarea",
    ctaLabel: "text",
    ctaHref: "link",
    variant: V,
  }),
  cta_split: L("CTA (splitt)", {
    title: "text",
    body: "textarea",
    image: "media",
    ctaLabel: "text",
    ctaHref: "link",
    variant: V,
  }),
  /** E-post påmelding — native form (not `form_embed` / generic `cta_block`). */
  newsletter_signup: L("Nyhetsbrev påmelding", {
    eyebrow: "text",
    title: "text",
    lede: "textarea",
    ctaLabel: "text",
    ctaHref: "link",
    disclaimer: "textarea",
    submitMethod: ["get", "post"],
    contentWidth: ["narrow", "normal", "wide"],
    variant: V,
  }),
  alert_bar: L("Varselstripe", {
    text: "text",
    ctaLabel: "text",
    ctaHref: "link",
    variant: V,
  }),

  text_block: L("Tekst", {
    title: "text",
    body: "textarea",
    variant: V,
  }),
  rich_text: L("Rik tekst", {
    heading: "text",
    body: "textarea",
    variant: V,
  }),

  /** Section chrome: kicker + H2 + short lede (no long body; use `text_block` / `rich_text` for prose). */
  section_intro: L("Seksjonsintro", {
    eyebrow: "text",
    title: "text",
    lede: "textarea",
    contentWidth: ["narrow", "normal", "wide"],
    variant: V,
  }),

  /** Editorial pull-quote — not `testimonial_block` (trust) or `highlight_block` (callout). */
  quote_block: L("Redaksjonelt sitat", {
    quote: "textarea",
    author: "text",
    role: "text",
    source: "text",
    contentWidth: ["narrow", "normal", "wide"],
    variant: V,
  }),
  highlight_block: L("Fremheving", {
    title: "text",
    body: "textarea",
    variant: V,
  }),
  steps_block: L("Steg", {
    title: "text",
    step1Title: "text",
    step1Body: "textarea",
    step2Title: "text",
    step2Body: "textarea",
    step3Title: "text",
    step3Body: "textarea",
    variant: V,
  }),
  timeline_block: L("Tidslinje", {
    title: "text",
    e1Title: "text",
    e1Body: "textarea",
    e2Title: "text",
    e2Body: "textarea",
    e3Title: "text",
    e3Body: "textarea",
    variant: V,
  }),
  /** KPI grid: JSON rows `{ id?, value, label, subtext?, icon?, emphasis? }` (legacy `s1Value`/`s1Label`… migrate at render). */
  stats_block: L("Nøkkeltall", {
    title: "text",
    kpisJson: "textarea",
    density: ["compact", "comfortable", "airy"],
    columns: ["2", "3", "4"],
    variant: V,
  }),
  code_block: L("Kode", {
    code: "textarea",
    caption: "text",
    variant: V,
  }),

  image_block: L("Bilde", {
    image: "media",
    alt: "text",
    caption: "textarea",
    variant: V,
  }),
  image_gallery: L("Bildegalleri", {
    i1: "media",
    i2: "media",
    i3: "media",
    alt1: "text",
    alt2: "text",
    alt3: "text",
    variant: V,
  }),
  split_block: L("Splitt innhold", {
    title: "text",
    leftTitle: "text",
    leftBody: "textarea",
    rightTitle: "text",
    rightBody: "textarea",
    variant: V,
  }),

  /** Umbraco `dualPromoCardsBlock` + nested `promoCardItem` rows (two-column promo, not generic split). */
  dual_promo_cards: L("Dobbelt promokort", {
    sectionId: "text",
    maxWidthVariant: "text",
    cardsJson: "textarea",
    variant: V,
  }),

  grid_2: L("Rutenett (2)", {
    title: "text",
    subtitle: "textarea",
    card1Title: "text",
    card1Image: "media",
    card2Title: "text",
    card2Image: "media",
    variant: V,
  }),
  grid_3: L("Rutenett (3)", {
    title: "text",
    subtitle: "textarea",
    card1Title: "text",
    card1Image: "media",
    card2Title: "text",
    card2Image: "media",
    card3Title: "text",
    card3Image: "media",
    variant: V,
  }),
  feature_grid: L("Funksjonsrutenett", {
    title: "text",
    subtitle: "textarea",
    f1Title: "text",
    f1Body: "textarea",
    f2Title: "text",
    f2Body: "textarea",
    f3Title: "text",
    f3Body: "textarea",
    cardMode: ["feature", "plain"],
    c1Label: "text",
    c1Href: "link",
    c2Label: "text",
    c2Href: "link",
    variant: V,
  }),
  card_grid: L("Kortrutenett", {
    title: "text",
    subtitle: "textarea",
    card1Title: "text",
    card1Body: "textarea",
    card1Image: "media",
    card2Title: "text",
    card2Body: "textarea",
    card2Image: "media",
    card3Title: "text",
    card3Body: "textarea",
    card3Image: "media",
    variant: V,
  }),

  /** One or more customer quotes; rows in `testimonialsJson` (legacy flat `quote`/`author`/… migrate at render). */
  testimonial_block: L("Kundesitat", {
    sectionTitle: "text",
    testimonialsJson: "textarea",
    density: ["compact", "comfortable", "airy"],
    variant: V,
  }),
  /** Trust / partner logos: JSON array of `{ id, image, label?, href? }` (see `logosFromLogoCloudData`). Legacy `l1`–`l4` migrate at render. */
  logo_cloud: L("Logoserie", {
    title: "text",
    logosJson: "textarea",
    density: ["compact", "comfortable", "airy"],
    variant: V,
  }),
  faq_block: L("FAQ", {
    sectionTitle: "text",
    q1: "text",
    a1: "textarea",
    q2: "text",
    a2: "textarea",
    q3: "text",
    a3: "textarea",
    variant: V,
  }),
  /** Umbraco `accordionOrTab` + nested items; accordion vs tabs from `displayMode`. */
  accordion_tabs: L("Accordion eller faner", {
    sectionTitle: "text",
    displayMode: "text",
    itemsJson: "textarea",
    defaultOpenIndex: "text",
    rememberOpen: "text",
    variant: V,
  }),
  pricing_table: L("Pris tabell", {
    title: "text",
    subtitle: "textarea",
    p1Name: "text",
    p1Subtitle: "text",
    p1Price: "text",
    p1Bullets: "textarea",
    p1CtaLabel: "text",
    p1CtaHref: "link",
    p1Highlight: ["no", "yes"],
    p2Name: "text",
    p2Subtitle: "text",
    p2Price: "text",
    p2Bullets: "textarea",
    p2CtaLabel: "text",
    p2CtaHref: "link",
    p2Highlight: ["no", "yes"],
    variant: V,
  }),
  comparison_table: L("Sammenligning", {
    title: "text",
    r1a: "text",
    r1b: "text",
    r2a: "text",
    r2b: "text",
    r3a: "text",
    r3b: "text",
    variant: V,
  }),
  case_study_block: L("Case", {
    title: "text",
    body: "textarea",
    image: "media",
    ctaLabel: "text",
    ctaHref: "link",
    variant: V,
  }),
  team_block: L("Team", {
    title: "text",
    m1Name: "text",
    m1Role: "text",
    m1Image: "media",
    m2Name: "text",
    m2Role: "text",
    m2Image: "media",
    variant: V,
  }),

  product_list: L("Produktliste (data)", {
    title: "text",
    hint: "textarea",
    variant: V,
  }),
  article_list: L("Artikkelliste (data)", {
    title: "text",
    hint: "textarea",
    variant: V,
  }),
  search_results: L("Søkeresultat (data)", {
    title: "text",
    hint: "textarea",
    variant: V,
  }),
  category_grid: L("Kategori-rutenett", {
    title: "text",
    c1Title: "text",
    c1Image: "media",
    c2Title: "text",
    c2Image: "media",
    c3Title: "text",
    c3Image: "media",
    variant: V,
  }),
  menu_list: L("Menyliste", {
    title: "text",
    items: "textarea",
    variant: V,
  }),
  order_summary: L("Ordreoppsummering", {
    title: "text",
    lines: "textarea",
    variant: V,
  }),
  dynamic_feed: L("Dynamisk feed", {
    title: "text",
    feedLink: "link",
    variant: V,
  }),

  /**
   * Eksternt skjema (https iframe), internt LP-skjema (`formId`), eller lagret HTML-snippet (kun forhåndsvisning).
   * Ikke nyhetsbrev — bruk `newsletter_signup`. Ikke ren CTA — bruk `cta_block`.
   */
  form_embed: L("Skjema (iframe / embed)", {
    formId: "text",
    iframeSrc: "link",
    title: "text",
    lede: "textarea",
    embedHtml: "textarea",
    contentWidth: ["narrow", "normal", "wide"],
    variant: V,
  }),

  related_links: L("Relaterte lenker", {
    title: "text",
    subtitle: "textarea",
    currentPath: "link",
    tagLines: "textarea",
    variant: V,
  }),

  zigzag_block: L("Zigzag (prosess)", {
    title: "text",
    zigzagSteps: "textarea",
    variant: V,
  }),

  /** Umbraco `anchorNavigation` + nested `anchorNavigationLink` rows (TOC / in-page nav). */
  anchor_navigation: L("Anker-navigasjon", {
    title: "text",
    itemsJson: "textarea",
    linkStyle: "text",
    navigationAlignment: "text",
    mobileStyle: "text",
    variant: V,
  }),

  section_divider: L("Skillelinje", {
    variant: V,
  }),
} as const;

function assertRegistryKeysMatchCore(): void {
  const reg = new Set(Object.keys(COMPONENT_REGISTRY));
  for (const k of CORE_COMPONENT_KEYS) {
    if (!reg.has(k)) {
      throw new Error(`CORE_COMPONENT_KEYS references «${k}» missing from COMPONENT_REGISTRY`);
    }
  }
  for (const k of reg) {
    if (!CORE_COMPONENT_KEYS.includes(k as (typeof CORE_COMPONENT_KEYS)[number])) {
      throw new Error(`COMPONENT_REGISTRY has «${k}» not listed in CORE_COMPONENT_KEYS / componentGroups`);
    }
  }
}

assertRegistryKeysMatchCore();

export type AiComponentType = keyof typeof COMPONENT_REGISTRY;

/** @deprecated Prefer {@link COMPONENT_REGISTRY}. */
export const COMPONENTS = Object.fromEntries(
  (Object.keys(COMPONENT_REGISTRY) as AiComponentType[]).map((k) => [
    k,
    { fields: Object.keys(COMPONENT_REGISTRY[k].fields) },
  ]),
) as unknown as {
  readonly [K in AiComponentType]: { readonly fields: readonly string[] };
};

export function isAiComponentType(type: string): type is AiComponentType {
  return Object.prototype.hasOwnProperty.call(COMPONENT_REGISTRY, type);
}

export function getAiComponentFields(type: string): readonly string[] | null {
  if (!isAiComponentType(type)) return null;
  return Object.keys(COMPONENT_REGISTRY[type].fields);
}

export function isRegistryEnumDef(def: RegistryFieldDef): def is readonly string[] {
  return Array.isArray(def);
}

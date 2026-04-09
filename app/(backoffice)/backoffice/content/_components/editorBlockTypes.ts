/**
 * Canonical block types for the content editor.
 * Align with `lib/cms/blocks/registry.ts` and `lib/public/blocks/renderBlock.tsx`.
 */

import type { BlockVariant } from "@/lib/cms/blocks/blockContracts";
import type { BlockConfig } from "@/lib/cms/design/designContract";

type WithBlockConfig = { config?: BlockConfig };

/** U91: Hero — content vs settings er eksplisitte lag (settings tom for standard-hero). */
export type HeroBlock = WithBlockConfig & {
  id: string;
  type: "hero";
  contentData: {
    title: string;
    subtitle?: string;
    imageId?: string;
    mediaItemId?: string;
    imageAlt?: string;
    ctaLabel?: string;
    ctaHref?: string;
  };
  settingsData: Record<string, never>;
};

export type HeroFullBlock = WithBlockConfig & {
  id: string;
  type: "hero_full";
  contentData: {
    title: string;
    subtitle?: string;
    imageId?: string;
    mediaItemId?: string;
    imageAlt?: string;
    ctaLabel?: string;
    ctaHref?: string;
  };
  settingsData: {
    useGradient?: boolean;
  };
};

/** Full-bleed hero (kant til kant) — maps to `components/blocks/HeroBlock`. */
export type HeroBleedBlock = WithBlockConfig & {
  id: string;
  type: "hero_bleed";
  contentData: {
    title: string;
    subtitle?: string;
    ctaPrimary?: string;
    ctaSecondary?: string;
    ctaPrimaryHref?: string;
    /** Editor-only: internal vs external link UI hint; public render uses `ctaPrimaryHref` string only. */
    ctaPrimaryHrefKind?: "internal" | "external";
    ctaSecondaryHref?: string;
    backgroundImageId?: string;
    backgroundMediaItemId?: string;
    overlayImageId?: string;
    overlayMediaItemId?: string;
    overlayImageAlt?: string;
  };
  settingsData: {
    variant?: BlockVariant;
    textAlign?: "left" | "center" | "right";
    textPosition?: "left" | "center" | "right";
    overlayPosition?: "left" | "center" | "right";
  };
};

export type RichTextBlock = WithBlockConfig & {
  id: string;
  type: "richText";
  heading?: string;
  body: string;
};

export type ImageBlock = WithBlockConfig & {
  id: string;
  type: "image";
  /** cms:*, UUID, path, or URL — canonical media reference for this block. */
  imageId: string;
  mediaItemId?: string;
  alt?: string;
  caption?: string;
};

export type CtaBlock = WithBlockConfig & {
  id: string;
  type: "cta";
  contentData: {
    eyebrow?: string;
    title: string;
    body?: string;
  };
  settingsData: Record<string, never>;
  structureData: {
    buttonLabel?: string;
    buttonHref?: string;
    secondaryButtonLabel?: string;
    secondaryButtonHref?: string;
  };
};

export type DividerBlock = WithBlockConfig & {
  id: string;
  type: "divider";
  style?: "line" | "space";
};

/** Value cards: one tile = tittel, brødtekst, valgfri etikett og lenke under kortet. */
export type CardRow = {
  title: string;
  text: string;
  /** Kort etikett over tittel (f.eks. «Levering»). */
  kicker?: string;
  linkLabel?: string;
  linkHref?: string;
};
export type CardsBlock = WithBlockConfig & {
  id: string;
  type: "cards";
  contentData: {
    title: string;
    text: string;
  };
  settingsData: {
    presentation?: "feature" | "plain";
  };
  structureData: {
    items: CardRow[];
    cta?: { label: string; href: string; variant?: string }[];
  };
};

export type ZigzagStep = {
  /** Vises i neon-ring (tall eller kort kode). */
  step: string;
  title: string;
  text: string;
  imageId: string;
  /** Valgfri mikro-etikett ved siden av steg (redaksjonell kontekst). */
  kicker?: string;
};
export type ZigzagBlock = WithBlockConfig & {
  id: string;
  type: "zigzag";
  contentData: {
    title: string;
    intro?: string;
  };
  settingsData: {
    presentation?: "process" | "faq";
  };
  structureData: {
    steps: ZigzagStep[];
  };
};

export type PricingPlanRow = {
  /** Pakkenavn (pill / nivå). */
  name: string;
  /** Kort undertittel under navn (h3), ikke det samme som pakkenavn. */
  tagline?: string;
  /** Valgfri merkelapp (f.eks. «Mest valgt»). */
  badge?: string;
  price: string;
  /** Prisperiode som vises sammen med pris (f.eks. «per kuvert»). */
  period?: string;
  featured?: boolean;
  features: string[];
  ctaLabel?: string;
  ctaHref?: string;
};

export type PricingBlock = WithBlockConfig & {
  id: string;
  type: "pricing";
  contentData: {
    title: string;
    intro?: string;
    footnote?: string;
  };
  settingsData: Record<string, never>;
  structureData: {
    plans: PricingPlanRow[];
  };
};

export type GridItemRow = {
  title: string;
  imageId: string;
  /** Undertittel under lokasjonsnavn. */
  subtitle?: string;
  /** Én linje fakta (adresse, åpningstid, …). */
  metaLine?: string;
};
export type GridBlock = WithBlockConfig & {
  id: string;
  type: "grid";
  contentData: {
    title: string;
    intro?: string;
  };
  settingsData: {
    variant?: BlockVariant;
  };
  structureData: {
    items: GridItemRow[];
  };
};

export type BannerBlock = WithBlockConfig & {
  id: string;
  type: "banner";
  text: string;
  ctaLabel: string;
  ctaHref: string;
  backgroundImageId: string;
  /** Mediearkiv-ID når bakgrunn er valgt fra arkiv (redaksjonell sporbarhet). */
  backgroundMediaItemId?: string;
  mediaItemId?: string;
  variant?: BlockVariant;
};

export type FormBlock = WithBlockConfig & {
  id: string;
  type: "form";
  formId: string;
  title?: string;
};

export type RelatedLinksBlock = WithBlockConfig & {
  id: string;
  type: "relatedLinks";
  contentData: {
    title?: string;
    subtitle?: string;
    emptyFallbackText?: string;
  };
  settingsData: {
    currentPath?: string;
    maxSuggestions?: number;
  };
  structureData: {
    tags: string[];
  };
};

export type Block =
  | HeroBlock
  | HeroFullBlock
  | HeroBleedBlock
  | BannerBlock
  | RichTextBlock
  | ImageBlock
  | CtaBlock
  | DividerBlock
  | CardsBlock
  | ZigzagBlock
  | PricingBlock
  | GridBlock
  | FormBlock
  | RelatedLinksBlock;

export type BlockType = Block["type"];

export type HeroSuggestion = {
  mediaId: string;
  url: string;
  alt?: string;
  filename?: string;
  basename?: string;
  reason: string;
};

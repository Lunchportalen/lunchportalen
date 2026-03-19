/**
 * Canonical block types for the content editor.
 * Single source of truth for Block union and related shapes.
 */

export type HeroBlock = {
  id: string;
  type: "hero";
  title: string;
  subtitle?: string;
  imageUrl?: string;
  /** Optional reference to media archive for syncing imageAlt. */
  mediaItemId?: string;
  imageAlt?: string;
  ctaLabel?: string;
  ctaHref?: string;
};

export type RichTextBlock = {
  id: string;
  type: "richText";
  heading?: string;
  body: string;
};

export type ImageBlock = {
  id: string;
  type: "image";
  assetPath: string;
  /** Optional reference to media archive item for syncing alt / metadata. */
  mediaItemId?: string;
  alt?: string;
  caption?: string;
};

export type CtaBlock = {
  id: string;
  type: "cta";
  title: string;
  body?: string;
  buttonLabel?: string;
  buttonHref?: string;
};

export type DividerBlock = {
  id: string;
  type: "divider";
  style?: "line" | "space";
};

export type BannerItemButton = { label: string; href: string };
export type BannerItem = {
  id: string;
  imageUrl?: string;
  videoSource?: "youtube" | "vimeo" | "mp4";
  videoUrl?: string;
  heading?: string;
  secondaryHeading?: string;
  text?: string;
  buttons?: BannerItemButton[];
  bannerStyle?: "takeover" | "medium" | "short" | "scale";
  backgroundColor?: string;
  scrollPrompt?: boolean;
  textAlignment?: "left" | "center" | "right";
  textPosition?: string;
  imageOpacity?: boolean;
  animate?: boolean;
  name?: string;
  anchorName?: string;
  customClasses?: string;
  hideFromWebsite?: boolean;
};

export type BannersBlock = {
  id: string;
  type: "banners";
  items: BannerItem[];
};

export type CodeBlock = {
  id: string;
  type: "code";
  code: string;
  displayIntro?: boolean;
  displayOutro?: boolean;
};

export type Block =
  | HeroBlock
  | RichTextBlock
  | ImageBlock
  | CtaBlock
  | DividerBlock
  | BannersBlock
  | CodeBlock;

export type BlockType = Block["type"];

export type HeroSuggestion = {
  mediaId: string;
  url: string;
  alt?: string;
  filename?: string;
  basename?: string;
  reason: string;
};

export type BannerVisualOption = {
  id: string;
  label: string;
  summary: string;
  changes: Partial<
    Pick<BannerItem, "bannerStyle" | "backgroundColor" | "textAlignment" | "textPosition" | "scrollPrompt">
  >;
};

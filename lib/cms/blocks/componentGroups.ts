/**
 * Enterprise CMS component layering — 40 locked types (AI + docs).
 * Must match keys in {@link COMPONENT_REGISTRY} exactly.
 */

export const COMPONENT_GROUPS = {
  hero: [
    "hero_bleed",
    "hero_split",
    "hero_minimal",
    "hero_centered",
    "hero_video",
  ],

  cta: ["banner", "promo_strip", "cta_block", "cta_split", "newsletter_signup", "alert_bar"],

  content: [
    "text_block",
    "rich_text",
    "quote_block",
    "highlight_block",
    "steps_block",
    "timeline_block",
    "stats_block",
    "code_block",
  ],

  layout: [
    "image_block",
    "image_gallery",
    "split_block",
    "grid_2",
    "grid_3",
    "feature_grid",
    "card_grid",
    "zigzag_block",
    "section_divider",
  ],

  trust: [
    "testimonial_block",
    "logo_cloud",
    "faq_block",
    "pricing_table",
    "comparison_table",
    "case_study_block",
    "team_block",
  ],

  data: [
    "product_list",
    "article_list",
    "search_results",
    "category_grid",
    "menu_list",
    "order_summary",
    "dynamic_feed",
    "form_embed",
    "related_links",
  ],
} as const;

/** Deterministic flat list — full registry keys (tuple for tier sync + tests). */
export const CORE_COMPONENT_KEYS = [
  ...COMPONENT_GROUPS.hero,
  ...COMPONENT_GROUPS.cta,
  ...COMPONENT_GROUPS.content,
  ...COMPONENT_GROUPS.layout,
  ...COMPONENT_GROUPS.trust,
  ...COMPONENT_GROUPS.data,
] as const;

export type CoreComponentKey = (typeof CORE_COMPONENT_KEYS)[number];

/** Alias for validators / prompts. */
export const ALL_COMPONENT_GROUP_KEYS: readonly string[] = [...CORE_COMPONENT_KEYS];

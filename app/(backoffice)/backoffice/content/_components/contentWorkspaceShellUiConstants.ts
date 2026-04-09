/**
 * Statiske UI-lister for ContentWorkspace (placeholder / Umbraco-lignende skall).
 * Ingen hooks; ingen preview-/save-logikk.
 */

export const DESIGN_LAYOUT_SECTION_LABELS = [
  "Site Header",
  "Navigation",
  "Icons",
  "Headings",
  "Images",
  "Links",
  "Miscellaneous",
] as const;

export const DESIGN_COLOR_PALETTE_HEX_SWATCHES = [
  "#000000",
  "#f2e8ce",
  "#644b36",
  "#fb6f01",
  "#f4b905",
  "#000000",
  "#22c55e",
  "#ec4899",
  "#3b82f6",
  "#8b5cf6",
  "#f4b905",
  "#fb6f01",
  "#06b6d4",
  "#ec4899",
  "#22c55e",
  "#7c2d12",
  "#c2410c",
] as const;

export const CONTENT_SETTINGS_TAB_TUPLES = [
  ["general", "Generell"],
  ["analytics", "Analytics"],
  ["form", "Skjema"],
  ["shop", "Butikk"],
  ["globalContent", "Globalt innhold"],
  ["notification", "Varsling"],
  ["scripts", "Scripts"],
  ["advanced", "Avansert"],
] as const;

export const CONTENT_DIRECTION_LTR_RTL_TUPLES = [
  ["ltr", "LTR"],
  ["rtl", "RTL"],
] as const;

export const EMAIL_PLATFORM_FORM_TAB_TUPLES = [
  ["campaignMonitor", "CAMPAIGN MONITOR"],
  ["mailchimp", "MAILCHIMP"],
] as const;

export const CAPTCHA_VERSION_FORM_TAB_TUPLES = [
  ["recaptchaV2", "RECAPTCHA V2"],
  ["recaptchaV3", "RECAPTCHA V3"],
  ["hcaptcha", "HCAPTCHA"],
  ["turnstile", "TURNSTILE"],
] as const;

export const GLOBAL_CONTENT_TOP_BOTTOM_PODS_ROWS = [
  ["Top components", "Legg til innhold"],
  ["Bottom components", "Legg til innhold"],
  ["Pods", "Legg til innhold"],
] as const;

export const GLOBAL_SCRIPT_INJECTION_SECTION_TUPLES = [
  [
    "Header opening scripts",
    "Alt som legges inn her plasseres rett etter åpning av <head>-taggen på alle sider.",
  ],
  [
    "Header closing scripts",
    "Alt som legges inn her plasseres rett før lukking av </head>-taggen på alle sider.",
  ],
  [
    "After opening body scripts",
    "Alt som legges inn her plasseres rett etter åpning av <body>-taggen på alle sider.",
  ],
  [
    "Before closing body scripts",
    "Alt som legges inn her plasseres rett før lukking av </body>-taggen på alle sider.",
  ],
] as const;

export const NAVIGATION_SUB_TAB_TUPLES = [
  ["main", "Main"],
  ["secondary", "Secondary"],
  ["footer", "Footer"],
  ["member", "Member"],
  ["cta", "CTA"],
  ["language", "Language"],
  ["advanced", "Advanced"],
] as const;

export const MAIN_NAV_PREVIEW_LABELS = [
  "Hjem",
  "Butikk",
  "Guider",
  "Oliven",
  "Olivenolje",
  "Kontakt",
  "Om oss",
  "Smaksopplevelse",
] as const;

export const MULTILINGUAL_MODE_TAB_TUPLES = [
  ["multiSite", "MULTI SITE"],
  ["oneToOne", "ONE TO ONE"],
] as const;

export type GlobalWorkspaceCardEntry = {
  id: "content-and-settings" | "header" | "navigation" | "footer" | "reusable-components" | null;
  title: string;
  description: string;
  icon: string;
};

export const GLOBAL_WORKSPACE_PANEL_CARDS: readonly GlobalWorkspaceCardEntry[] = [
  {
    id: "content-and-settings",
    title: "Innhold og innstillinger",
    description: "Administrer det globale innholdet og innstillingene som gjelder for nettstedet.",
    icon: "–",
  },
  {
    id: "header",
    title: "Header",
    description: "Administrer header for det offentlige nettstedet (logo, faner, innlogging).",
    icon: "⊞",
  },
  {
    id: "navigation",
    title: "Navigasjon",
    description: "Administrer de globale navigasjonsmenyene på nettstedet.",
    icon: "–",
  },
  {
    id: "footer",
    title: "Footer",
    description: "Opprett og administrer global footer.",
    icon: "⊞",
  },
  {
    id: "reusable-components",
    title: "Gjenbrukbare komponenter",
    description: "Opprett og administrer komponentgrupper som kan brukes på tvers av nettstedet.",
    icon: "–",
  },
  {
    id: null,
    title: "Gjenbrukbare pods",
    description: "Opprett og administrer pods som kan legges til flere steder. Ås i et modalt vindu.",
    icon: "–",
  },
];

export const REUSABLE_COMPONENT_GROUPS_PLACEHOLDER = [
  { title: "Maps", components: 2, updated: "2025-03-15 11:36", createdBy: "uSkinned" },
  { title: "Size Guide", components: 2, updated: "2025-03-15 11:36", createdBy: "uSkinned" },
] as const;

export const DESIGN_FONT_STACK_PLACEHOLDER_LABELS = [
  "Funnel Sans, sans-serif, normal, 300",
  'font-family: "roca", sans-serif, font-style: normal; font-weight: 400;',
  "futura-pt, sans-serif, normal, 400;",
  "roca, sans-serif, normal, 800;",
] as const;

export const DESIGN_TYPOGRAPHY_ROLE_LABELS = [
  "Body",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "Heading (small)",
  "Heading (medium)",
  "Heading (large)",
  "Secondary heading (small)",
  "Secondary heading (medium)",
  "Secondary heading (large)",
  "Introduction (small)",
  "Introduction (medium)",
  "Introduction (large)",
  "Blockquote (small)",
  "Blockquote (medium)",
  "Blockquote (large)",
  "Button (small)",
  "Button (medium)",
  "Button (large)",
  "Main navigation",
  "Secondary navigation",
  "Navigation dropdowns",
  "Sub navigation",
  "Footer navigation",
  "Breadcrumb navigation",
  "Anchor navigation",
  "Accordion & tab navigation",
  "Logo",
] as const;

export const BACKGROUND_SECTION_LABELS = ["Body", "Header", "Footer"] as const;

export const BACKGROUND_IMAGE_REPEAT_MODE_LABELS = [
  "COVER",
  "FULL-WIDTH",
  "AUTO",
  "REPEAT",
  "REPEAT HORIZONTAL",
  "REPEAT VERTICAL",
] as const;

export const BACKGROUND_IMAGE_POSITION_ICONS = ["–", "+", "–", "–", "–", "–", "–", "–", "+"] as const;

export const GLOBAL_MODAL_TIMING_LABELS = ["TIMED", "SCROLL"] as const;

export const FOOTER_LEGAL_LINK_LABELS = ["Terms & Conditions", "Privacy Policy", "Sitemap"] as const;

export const LABEL_COLOR_PICKER_ROW_LABELS = [
  "Background",
  "Heading",
  "Secondary Heading",
  "Text",
  "Link",
  "Link hover",
  "Border",
  "Highlight background",
  "Highlight text",
] as const;

export const THREE_PANEL_COLOR_LABELS = ["Background", "Text", "Border"] as const;

export const THREE_PANEL_HOVER_COLOR_LABELS = ["Background hover", "Text hover", "Border hover"] as const;

/**
 * AI UI designer: generates a UI layout specification from page purpose and audience.
 * Deterministic; no LLM. Use for backoffice, editor, or API consumers that need
 * a structured layout spec (sections, components, hierarchy).
 */

export type GenerateInterfaceInput = {
  /** Purpose of the page (e.g. landing, dashboard, form, settings, onboarding). */
  pagePurpose: string;
  /** Target audience (e.g. visitor, employee, company_admin, superadmin). */
  audience: string;
  /** Optional locale for labels and hints (nb | en). */
  locale?: "nb" | "en" | null;
};

export type SectionSpec = {
  id: string;
  order: number;
  label: string;
  description: string;
  /** Suggested component types for this section (e.g. hero, card_grid, cta_block). */
  componentHints: string[];
  /** Layout hint (e.g. full_width, contained, grid_2col). */
  layoutHint: string;
  /** Audience-specific note if relevant. */
  audienceNote?: string | null;
};

export type UILayoutSpecification = {
  /** Layout type for the page (single_column, dashboard, form, marketing, settings). */
  layoutType: string;
  /** Human-readable description of the layout. */
  layoutDescription: string;
  /** Max content width in px (optional). */
  maxWidthPx?: number | null;
  /** Main grid columns (e.g. 1, 2, 12 for dashboard). */
  gridColumns?: number | null;
  /** Ordered sections with component and layout hints. */
  sections: SectionSpec[];
  /** Optional global content hints (e.g. headline length, CTA count). */
  contentHints?: {
    primaryCtaCount?: number | null;
    headlineMaxWords?: number | null;
    sectionMaxCount?: number | null;
  } | null;
  /** Short summary. */
  summary: string;
  /** ISO timestamp. */
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

type LayoutTemplate = {
  layoutType: string;
  layoutDescriptionEn: string;
  layoutDescriptionNb: string;
  maxWidthPx: number | null;
  gridColumns: number | null;
  sections: {
    id: string;
    order: number;
    labelEn: string;
    labelNb: string;
    descriptionEn: string;
    descriptionNb: string;
    componentHints: string[];
    layoutHint: string;
    audienceNoteEn?: string;
    audienceNoteNb?: string;
  }[];
  contentHints: { primaryCtaCount?: number; headlineMaxWords?: number; sectionMaxCount?: number } | null;
};

const TEMPLATES: Record<string, LayoutTemplate> = {
  marketing_visitor: {
    layoutType: "marketing",
    layoutDescriptionEn: "Single-column marketing layout: hero, value props, social proof, CTA, optional FAQ.",
    layoutDescriptionNb: "Enspaltet markedsføringslayout: hero, verdier, sosialt bevis, CTA, valgfri FAQ.",
    maxWidthPx: 1200,
    gridColumns: 1,
    sections: [
      { id: "hero", order: 1, labelEn: "Hero", labelNb: "Hero", descriptionEn: "Above-the-fold headline, subheadline, primary CTA.", descriptionNb: "Overskrift, underoverskrift og hoved-CTA over fold.", componentHints: ["hero", "headline", "cta"], layoutHint: "full_width" },
      { id: "features", order: 2, labelEn: "Features", labelNb: "Funksjoner", descriptionEn: "Value props or feature highlights.", descriptionNb: "Verdier eller funksjonspunkter.", componentHints: ["card_grid", "feature_list", "icons"], layoutHint: "contained" },
      { id: "social_proof", order: 3, labelEn: "Social proof", labelNb: "Sosialt bevis", descriptionEn: "Testimonials, logos, or trust signals.", descriptionNb: "Anmeldelser, logoer eller tillitssignaler.", componentHints: ["testimonials", "logo_strip", "stats"], layoutHint: "contained" },
      { id: "cta", order: 4, labelEn: "CTA", labelNb: "Oppfordring", descriptionEn: "Conversion block: headline, copy, button.", descriptionNb: "Konverteringsblokk: overskrift, tekst, knapp.", componentHints: ["cta_block", "button"], layoutHint: "contained" },
      { id: "faq", order: 5, labelEn: "FAQ", labelNb: "FAQ", descriptionEn: "Frequently asked questions.", descriptionNb: "Vanlige spørsmål.", componentHints: ["accordion", "faq_list"], layoutHint: "contained" },
    ],
    contentHints: { primaryCtaCount: 1, headlineMaxWords: 10, sectionMaxCount: 6 },
  },
  dashboard_admin: {
    layoutType: "dashboard",
    layoutDescriptionEn: "Dashboard layout: sidebar navigation, main content area with optional header and KPI cards.",
    layoutDescriptionNb: "Dashboard-layout: sidemeny, hovedområde med valgfri header og KPI-kort.",
    maxWidthPx: 1440,
    gridColumns: 12,
    sections: [
      { id: "sidebar", order: 1, labelEn: "Sidebar", labelNb: "Sidemeny", descriptionEn: "Primary navigation and scope.", descriptionNb: "Hovednavigasjon og scope.", componentHints: ["nav_vertical", "nav_tabs"], layoutHint: "sidebar", audienceNoteEn: "Role determines visible items.", audienceNoteNb: "Rolle styrer synlige elementer." },
      { id: "header", order: 2, labelEn: "Header", labelNb: "Header", descriptionEn: "Page title, breadcrumb, actions.", descriptionNb: "Sidetittel, brødsmule, handlinger.", componentHints: ["page_title", "breadcrumb", "actions"], layoutHint: "full_width" },
      { id: "kpi", order: 3, labelEn: "KPI / summary", labelNb: "KPI / oppsummering", descriptionEn: "Key metrics or summary cards.", descriptionNb: "Nøkkeltall eller oppsummeringskort.", componentHints: ["kpi_cards", "stat_cards"], layoutHint: "grid_3col" },
      { id: "main", order: 4, labelEn: "Main content", labelNb: "Hovedinnhold", descriptionEn: "Primary content: table, list, or detail.", descriptionNb: "Hovedinnhold: tabell, liste eller detalj.", componentHints: ["table", "list", "card_list", "detail_view"], layoutHint: "main" },
    ],
    contentHints: { sectionMaxCount: 8 },
  },
  form_employee: {
    layoutType: "form",
    layoutDescriptionEn: "Form-focused layout: clear steps or single form, one primary action, minimal distraction.",
    layoutDescriptionNb: "Skjemasentrert layout: tydelige steg eller ett skjema, én primær handling, minimal distraksjon.",
    maxWidthPx: 560,
    gridColumns: 1,
    sections: [
      { id: "header", order: 1, labelEn: "Form header", labelNb: "Skjemaheader", descriptionEn: "Title and optional progress.", descriptionNb: "Tittel og valgfritt fremdrift.", componentHints: ["title", "progress_steps"], layoutHint: "contained" },
      { id: "form", order: 2, labelEn: "Form body", labelNb: "Skjemainnhold", descriptionEn: "Fields, validation, optional help.", descriptionNb: "Felt, validering, valgfri hjelp.", componentHints: ["form", "input_group", "validation"], layoutHint: "contained" },
      { id: "actions", order: 3, labelEn: "Actions", labelNb: "Handlinger", descriptionEn: "Primary submit, optional secondary.", descriptionNb: "Primær send, valgfri sekundær.", componentHints: ["button_primary", "button_secondary"], layoutHint: "contained" },
    ],
    contentHints: { primaryCtaCount: 1, sectionMaxCount: 4 },
  },
  settings_admin: {
    layoutType: "settings",
    layoutDescriptionEn: "Settings layout: grouped sections, labels, inputs, save actions.",
    layoutDescriptionNb: "Innstillinger: grupperte seksjoner, etiketter, felt, lagre-handlinger.",
    maxWidthPx: 720,
    gridColumns: 1,
    sections: [
      { id: "section_group", order: 1, labelEn: "Settings group", labelNb: "Innstillingsgruppe", descriptionEn: "Logical group with heading and fields.", descriptionNb: "Logisk gruppe med overskrift og felt.", componentHints: ["fieldset", "input", "toggle", "select"], layoutHint: "contained" },
      { id: "actions", order: 2, labelEn: "Save actions", labelNb: "Lagre-handlinger", descriptionEn: "Save, cancel, optional danger zone.", descriptionNb: "Lagre, avbryt, valgfri fare-sone.", componentHints: ["button_primary", "button_secondary", "danger_zone"], layoutHint: "contained" },
    ],
    contentHints: { sectionMaxCount: 10 },
  },
  onboarding_visitor: {
    layoutType: "single_column",
    layoutDescriptionEn: "Onboarding: full-bleed card, one primary action per step, clear progress.",
    layoutDescriptionNb: "Onboarding: full-bleed-kort, én primær handling per steg, tydelig fremdrift.",
    maxWidthPx: 480,
    gridColumns: 1,
    sections: [
      { id: "progress", order: 1, labelEn: "Progress", labelNb: "Fremdrift", descriptionEn: "Step indicator.", descriptionNb: "Stegindikator.", componentHints: ["progress_steps", "stepper"], layoutHint: "contained" },
      { id: "content", order: 2, labelEn: "Step content", labelNb: "Steginnhold", descriptionEn: "Copy and single primary action.", descriptionNb: "Tekst og én primær handling.", componentHints: ["headline", "body", "cta"], layoutHint: "contained" },
    ],
    contentHints: { primaryCtaCount: 1, headlineMaxWords: 8, sectionMaxCount: 4 },
  },
  default: {
    layoutType: "single_column",
    layoutDescriptionEn: "Single-column layout: header and content sections.",
    layoutDescriptionNb: "Enspaltet layout: header og innholdsseksjoner.",
    maxWidthPx: 1200,
    gridColumns: 1,
    sections: [
      { id: "header", order: 1, labelEn: "Header", labelNb: "Header", descriptionEn: "Page title or hero.", descriptionNb: "Sidetittel eller hero.", componentHints: ["title", "hero"], layoutHint: "contained" },
      { id: "content", order: 2, labelEn: "Content", labelNb: "Innhold", descriptionEn: "Main content blocks.", descriptionNb: "Hovedinnholdsblokker.", componentHints: ["card", "text", "list"], layoutHint: "contained" },
    ],
    contentHints: { sectionMaxCount: 8 },
  },
};

function selectTemplate(pagePurpose: string, audience: string): LayoutTemplate {
  const purpose = normalize(pagePurpose);
  const aud = normalize(audience);

  if ((purpose.includes("landing") || purpose.includes("marketing") || purpose.includes("home")) && (aud.includes("visitor") || aud.includes("guest") || aud.includes("public")))
    return TEMPLATES.marketing_visitor;
  if ((purpose.includes("dashboard") || purpose.includes("admin") || purpose.includes("overview")) && (aud.includes("admin") || aud.includes("superadmin") || aud.includes("company_admin")))
    return TEMPLATES.dashboard_admin;
  if ((purpose.includes("form") || purpose.includes("order") || purpose.includes("submit")) && (aud.includes("employee") || aud.includes("user")))
    return TEMPLATES.form_employee;
  if ((purpose.includes("settings") || purpose.includes("config") || purpose.includes("preferences")) && (aud.includes("admin") || aud.includes("company_admin")))
    return TEMPLATES.settings_admin;
  if ((purpose.includes("onboarding") || purpose.includes("registration") || purpose.includes("signup")) && (aud.includes("visitor") || aud.includes("guest")))
    return TEMPLATES.onboarding_visitor;

  if (purpose.includes("dashboard") || purpose.includes("admin")) return TEMPLATES.dashboard_admin;
  if (purpose.includes("form") || purpose.includes("order")) return TEMPLATES.form_employee;
  if (purpose.includes("settings")) return TEMPLATES.settings_admin;
  if (purpose.includes("landing") || purpose.includes("marketing")) return TEMPLATES.marketing_visitor;
  if (purpose.includes("onboarding")) return TEMPLATES.onboarding_visitor;

  return TEMPLATES.default;
}

/**
 * Generates a UI layout specification from page purpose and audience. Deterministic; no external calls.
 */
export function generateInterface(input: GenerateInterfaceInput): UILayoutSpecification {
  const pagePurpose = safeStr(input.pagePurpose) || "page";
  const audience = safeStr(input.audience) || "visitor";
  const isEn = input.locale === "en";

  const template = selectTemplate(pagePurpose, audience);

  const sections: SectionSpec[] = template.sections.map((s) => ({
    id: s.id,
    order: s.order,
    label: isEn ? s.labelEn : s.labelNb,
    description: isEn ? s.descriptionEn : s.descriptionNb,
    componentHints: s.componentHints,
    layoutHint: s.layoutHint,
    audienceNote: isEn ? (s.audienceNoteEn ?? null) : (s.audienceNoteNb ?? null),
  }));

  const summary = isEn
    ? `UI layout: ${template.layoutType} for "${pagePurpose}" (audience: ${audience}). ${sections.length} section(s).`
    : `UI-layout: ${template.layoutType} for "${pagePurpose}" (publikum: ${audience}). ${sections.length} seksjon(er).`;

  return {
    layoutType: template.layoutType,
    layoutDescription: isEn ? template.layoutDescriptionEn : template.layoutDescriptionNb,
    maxWidthPx: template.maxWidthPx,
    gridColumns: template.gridColumns,
    sections,
    contentHints: template.contentHints ?? undefined,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

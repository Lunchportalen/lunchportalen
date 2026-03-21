/**
 * UI component generator capability: generateUIComponents.
 * From component types or section hints, produces UI component specs: props, variants,
 * accessibility hints, and usage. Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateUIComponents";

const generateUIComponentsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "UI component generator: from component types (e.g. hero, cta_block, card_grid) or section hints, produces component specifications: props (name, type, required), variants, accessibility hints, and usage. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Generate UI components input",
    properties: {
      componentTypes: {
        type: "array",
        description: "Component type IDs to generate specs for (e.g. hero, cta_block, card_grid)",
        items: { type: "string" },
      },
      sectionHints: {
        type: "array",
        description: "Alternative: component hints from layout sections (e.g. from generateInterface)",
        items: { type: "string" },
      },
      framework: {
        type: "string",
        description: "Optional: react | vue | vanilla (for usage hints)",
      },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "Generated UI component specifications",
    required: ["components", "summary", "generatedAt"],
    properties: {
      components: {
        type: "array",
        items: {
          type: "object",
          required: ["componentId", "type", "name", "propsSpec"],
          properties: {
            componentId: { type: "string" },
            type: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            propsSpec: {
              type: "array",
              items: {
                type: "object",
                required: ["name", "type", "required"],
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  required: { type: "boolean" },
                  description: { type: "string" },
                },
              },
            },
            variants: { type: "array", items: { type: "string" } },
            accessibilityHints: { type: "array", items: { type: "string" } },
            usageHint: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is component specs only; no render or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateUIComponentsCapability);

export type PropSpec = {
  name: string;
  type: string;
  required: boolean;
  description?: string | null;
};

export type GeneratedUIComponent = {
  componentId: string;
  type: string;
  name: string;
  description?: string | null;
  propsSpec: PropSpec[];
  variants?: string[] | null;
  accessibilityHints?: string[] | null;
  usageHint?: string | null;
};

export type GenerateUIComponentsInput = {
  componentTypes?: string[] | null;
  sectionHints?: string[] | null;
  framework?: string | null;
  locale?: "nb" | "en" | null;
};

export type GenerateUIComponentsOutput = {
  components: GeneratedUIComponent[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeType(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

type ComponentDef = {
  type: string;
  nameEn: string;
  nameNb: string;
  descriptionEn: string;
  descriptionNb: string;
  propsSpec: PropSpec[];
  variants: string[];
  accessibilityHints: string[];
  usageHintEn: string;
  usageHintNb: string;
};

const COMPONENT_SPECS: Record<string, ComponentDef> = {
  hero: {
    type: "hero",
    nameEn: "Hero",
    nameNb: "Hero",
    descriptionEn: "Above-the-fold headline, subheadline, optional image, primary CTA.",
    descriptionNb: "Overskrift, underoverskrift, valgfritt bilde, hoved-CTA.",
    propsSpec: [
      { name: "headline", type: "string", required: true, description: "Main headline" },
      { name: "subheadline", type: "string", required: false, description: "Supporting line" },
      { name: "ctaLabel", type: "string", required: false, description: "Primary button text" },
      { name: "ctaHref", type: "string", required: false, description: "Primary button link" },
      { name: "imageUrl", type: "string", required: false, description: "Optional hero image" },
      { name: "imagePosition", type: "string", required: false, description: "right | left | background" },
    ],
    variants: ["centered", "split", "full_bleed", "minimal"],
    accessibilityHints: ["One H1 per view", "CTA has visible focus", "Image has alt text"],
    usageHintEn: "Use for landing or key conversion entry.",
    usageHintNb: "Bruk for landingsside eller viktig konverteringspunkt.",
  },
  cta_block: {
    type: "cta_block",
    nameEn: "CTA block",
    nameNb: "CTA-blokk",
    descriptionEn: "Conversion block: headline, supporting copy, primary button.",
    descriptionNb: "Konverteringsblokk: overskrift, støttetekst, primærknapp.",
    propsSpec: [
      { name: "headline", type: "string", required: true, description: "Block headline" },
      { name: "body", type: "string", required: false, description: "Short supporting text" },
      { name: "buttonLabel", type: "string", required: true, description: "Primary CTA label" },
      { name: "buttonHref", type: "string", required: false, description: "Link or action" },
    ],
    variants: ["primary", "secondary", "banner"],
    accessibilityHints: ["Single primary action", "Button has aria-label if icon-only", "Sufficient contrast"],
    usageHintEn: "One primary CTA per block; avoid multiple competing actions.",
    usageHintNb: "Én primær CTA per blokk; unngå flere konkurrerende handlinger.",
  },
  card_grid: {
    type: "card_grid",
    nameEn: "Card grid",
    nameNb: "Kortrute",
    descriptionEn: "Grid of cards (e.g. features, products); configurable columns.",
    descriptionNb: "Rute med kort (f.eks. funksjoner, produkter); konfigurerbare kolonner.",
    propsSpec: [
      { name: "items", type: "array", required: true, description: "Card items" },
      { name: "columns", type: "number", required: false, description: "2 | 3 | 4" },
      { name: "cardTitleKey", type: "string", required: false, description: "Key for title in item" },
      { name: "cardDescriptionKey", type: "string", required: false, description: "Key for description" },
    ],
    variants: ["default", "bordered", "elevated"],
    accessibilityHints: ["List or grid role", "Card titles as headings", "Touch targets ≥ 44px"],
    usageHintEn: "Use for 3–6 feature or product highlights.",
    usageHintNb: "Bruk for 3–6 funksjons- eller produktpunkter.",
  },
  feature_list: {
    type: "feature_list",
    nameEn: "Feature list",
    nameNb: "Funksjonsliste",
    descriptionEn: "List of value props with optional icon or number.",
    descriptionNb: "Liste med verdier med valgfritt ikon eller tall.",
    propsSpec: [
      { name: "items", type: "array", required: true, description: "Feature items" },
      { name: "showIcons", type: "boolean", required: false, description: "Show leading icon" },
      { name: "ordered", type: "boolean", required: false, description: "Numbered list" },
    ],
    variants: ["icons", "numbers", "plain"],
    accessibilityHints: ["List semantics", "Icon decorative or labelled"],
    usageHintEn: "3–6 items; each: short heading + 1–2 sentences.",
    usageHintNb: "3–6 punkter; hver: kort overskrift + 1–2 setninger.",
  },
  testimonials: {
    type: "testimonials",
    nameEn: "Testimonials",
    nameNb: "Anmeldelser",
    descriptionEn: "Social proof: quote, attribution, optional avatar.",
    descriptionNb: "Sosialt bevis: sitat, attribusjon, valgfritt avatar.",
    propsSpec: [
      { name: "items", type: "array", required: true, description: "Testimonial items" },
      { name: "quoteKey", type: "string", required: false, description: "Key for quote text" },
      { name: "authorKey", type: "string", required: false, description: "Key for author name" },
    ],
    variants: ["carousel", "grid", "single"],
    accessibilityHints: ["blockquote semantics", "Author and role exposed", "No auto-advance without pause"],
    usageHintEn: "2–4 testimonials; short quotes work best.",
    usageHintNb: "2–4 anmeldelser; korte sitater fungerer best.",
  },
  accordion: {
    type: "accordion",
    nameEn: "Accordion",
    nameNb: "Accordion",
    descriptionEn: "Expandable Q&A or content panels.",
    descriptionNb: "Utvidbare spørsmål/svar eller innholdspaneler.",
    propsSpec: [
      { name: "items", type: "array", required: true, description: "Panels: title + content" },
      { name: "allowMultiple", type: "boolean", required: false, description: "Multiple open at once" },
      { name: "defaultOpenIndex", type: "number", required: false, description: "Initially open panel" },
    ],
    variants: ["single", "multiple"],
    accessibilityHints: ["aria-expanded", "Keyboard (Enter/Space)", "Focus management"],
    usageHintEn: "FAQ or 4–8 expandable items.",
    usageHintNb: "FAQ eller 4–8 utvidbare elementer.",
  },
  nav_vertical: {
    type: "nav_vertical",
    nameEn: "Vertical nav",
    nameNb: "Vertikal meny",
    descriptionEn: "Sidebar or vertical navigation links.",
    descriptionNb: "Sidemeny eller vertikale navigasjonslenker.",
    propsSpec: [
      { name: "items", type: "array", required: true, description: "Nav items: label, href, active?" },
      { name: "ariaLabel", type: "string", required: true, description: "Accessible label for nav" },
    ],
    variants: ["sidebar", "tabs_vertical"],
    accessibilityHints: ["nav landmark", "Current page indicated", "Touch targets ≥ 44px"],
    usageHintEn: "Role determines visible items; server-side scope.",
    usageHintNb: "Rolle styrer synlige elementer; server-side scope.",
  },
  kpi_cards: {
    type: "kpi_cards",
    nameEn: "KPI cards",
    nameNb: "KPI-kort",
    descriptionEn: "Summary metric cards: label, value, optional trend.",
    descriptionNb: "Oppsummeringskort: etiketten, verdi, valgfritt trend.",
    propsSpec: [
      { name: "items", type: "array", required: true, description: "KPI items" },
      { name: "labelKey", type: "string", required: false, description: "Key for label" },
      { name: "valueKey", type: "string", required: false, description: "Key for value" },
    ],
    variants: ["compact", "full", "with_trend"],
    accessibilityHints: ["Live region if dynamic", "Numbers formatted", "Trend up/down announced"],
    usageHintEn: "1–3 meaningful KPIs per view.",
    usageHintNb: "1–3 meningsfulle KPI-er per visning.",
  },
  form: {
    type: "form",
    nameEn: "Form",
    nameNb: "Skjema",
    descriptionEn: "Form container: fields, validation, submit.",
    descriptionNb: "Skjemakontainer: felt, validering, send.",
    propsSpec: [
      { name: "action", type: "string", required: false, description: "Submit URL or handler" },
      { name: "method", type: "string", required: false, description: "get | post" },
      { name: "children", type: "node", required: true, description: "Form fields" },
    ],
    variants: ["default", "stacked", "inline"],
    accessibilityHints: ["Labels for all inputs", "Errors associated with fields", "Submit button explicit"],
    usageHintEn: "One primary submit; validation before submit.",
    usageHintNb: "Én primær send; validering før sending.",
  },
  button_primary: {
    type: "button_primary",
    nameEn: "Primary button",
    nameNb: "Primærknapp",
    descriptionEn: "Primary action button.",
    descriptionNb: "Primær handlingsknapp.",
    propsSpec: [
      { name: "label", type: "string", required: true, description: "Button text" },
      { name: "href", type: "string", required: false, description: "Link (if anchor)" },
      { name: "disabled", type: "boolean", required: false, description: "Disabled state" },
    ],
    variants: ["default", "full_width"],
    accessibilityHints: ["One primary per view/section", "Visible focus ring", "Contrast compliant"],
    usageHintEn: "Exactly one primary action per section.",
    usageHintNb: "Nøyaktig én primær handling per seksjon.",
  },
};

const HINT_TO_TYPE: Record<string, string> = {
  hero: "hero",
  headline: "hero",
  cta: "cta_block",
  cta_block: "cta_block",
  button: "button_primary",
  card_grid: "card_grid",
  feature_list: "feature_list",
  features: "feature_list",
  icons: "feature_list",
  testimonials: "testimonials",
  logo_strip: "card_grid",
  stats: "kpi_cards",
  accordion: "accordion",
  faq_list: "accordion",
  nav_vertical: "nav_vertical",
  nav_tabs: "nav_vertical",
  kpi_cards: "kpi_cards",
  stat_cards: "kpi_cards",
  form: "form",
  input_group: "form",
  validation: "form",
  button_primary: "button_primary",
  button_secondary: "button_primary",
  title: "hero",
  progress_steps: "accordion",
  stepper: "accordion",
  page_title: "hero",
  breadcrumb: "nav_vertical",
  actions: "button_primary",
  table: "card_grid",
  list: "card_grid",
  card_list: "card_grid",
  detail_view: "card_grid",
};

function resolveTypes(componentTypes: string[], sectionHints: string[]): string[] {
  const out = new Set<string>();
  for (const t of componentTypes) {
    const n = normalizeType(t);
    if (COMPONENT_SPECS[n]) out.add(n);
    else if (HINT_TO_TYPE[n]) out.add(HINT_TO_TYPE[n]);
  }
  for (const h of sectionHints) {
    const n = normalizeType(h);
    if (COMPONENT_SPECS[n]) out.add(n);
    else if (HINT_TO_TYPE[n]) out.add(HINT_TO_TYPE[n]);
  }
  return Array.from(out);
}

/**
 * Generates UI component specifications from component types or section hints. Deterministic; no external calls.
 */
export function generateUIComponents(input: GenerateUIComponentsInput): GenerateUIComponentsOutput {
  const componentTypes = Array.isArray(input.componentTypes) ? input.componentTypes.map(safeStr).filter(Boolean) : [];
  const sectionHints = Array.isArray(input.sectionHints) ? input.sectionHints.map(safeStr).filter(Boolean) : [];
  const isEn = input.locale === "en";

  const types = resolveTypes(componentTypes, sectionHints);
  if (types.length === 0) {
    types.push("hero", "cta_block", "card_grid");
  }

  const components: GeneratedUIComponent[] = types.map((type, i) => {
    const def = COMPONENT_SPECS[type];
    if (!def) {
      return {
        componentId: `component_${i + 1}`,
        type,
        name: type,
        description: isEn ? `Component type: ${type}.` : `Komponenttype: ${type}.`,
        propsSpec: [],
        variants: null,
        accessibilityHints: [isEn ? "Follow design system." : "Følg designsystem."],
        usageHint: null,
      };
    }
    return {
      componentId: `component_${type}_${i + 1}`,
      type: def.type,
      name: isEn ? def.nameEn : def.nameNb,
      description: isEn ? def.descriptionEn : def.descriptionNb,
      propsSpec: def.propsSpec,
      variants: def.variants.length > 0 ? def.variants : null,
      accessibilityHints: def.accessibilityHints.length > 0 ? def.accessibilityHints : null,
      usageHint: isEn ? def.usageHintEn : def.usageHintNb,
    };
  });

  const summary = isEn
    ? `Generated ${components.length} UI component specification(s).`
    : `Genererte ${components.length} UI-komponent spesifikasjon(er).`;

  return {
    components,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateUIComponentsCapability, CAPABILITY_NAME };

/**
 * AI component suggestion capability: suggestComponents.
 * Suggests UI components by context: page purpose, section type, or general. Returns name, role, whenToUse, category.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestComponents";

const suggestComponentsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Suggests UI components by context: page purpose or section type (hero, features, cta, faq, form). Returns component name, role, when to use, and category (layout, content, form, feedback).",
  requiredContext: ["context"],
  inputSchema: {
    type: "object",
    description: "Component suggestion input",
    properties: {
      context: {
        type: "string",
        description: "Context: page purpose (landing, product, blog) or section type (hero, features, cta, faq, form) or 'general'",
      },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
      limit: { type: "number", description: "Max components to return (default all)" },
    },
    required: ["context"],
  },
  outputSchema: {
    type: "object",
    description: "Component suggestions",
    required: ["components", "summary"],
    properties: {
      components: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "role", "whenToUse", "category"],
          properties: {
            name: { type: "string" },
            role: { type: "string" },
            whenToUse: { type: "string" },
            category: { type: "string", description: "layout | content | form | feedback | navigation" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestComponentsCapability);

export type SuggestComponentsInput = {
  context: string;
  locale?: "nb" | "en" | null;
  limit?: number | null;
};

export type ComponentSuggestion = {
  name: string;
  role: string;
  whenToUse: string;
  category: "layout" | "content" | "form" | "feedback" | "navigation";
};

export type SuggestComponentsOutput = {
  components: ComponentSuggestion[];
  summary: string;
};

type ComponentDef = {
  name: string;
  roleEn: string;
  roleNb: string;
  whenEn: string;
  whenNb: string;
  category: ComponentSuggestion["category"];
  contexts: string[];
};

const COMPONENTS: ComponentDef[] = [
  {
    name: "Hero",
    roleEn: "Above-the-fold headline and primary CTA",
    roleNb: "Overskrift og hoved-CTA over fold",
    whenEn: "Landing or marketing page; one per view.",
    whenNb: "Landingsside eller markedsføringsside; én per visning.",
    category: "layout",
    contexts: ["landing", "hero", "marketing", "general"],
  },
  {
    name: "Card",
    roleEn: "Container for grouped content",
    roleNb: "Container for gruppert innhold",
    whenEn: "Features, pricing, or any grouped block; use .lp-card for consistency.",
    whenNb: "Funksjoner, priser eller grupperte blokker; bruk .lp-card for konsistens.",
    category: "layout",
    contexts: ["features", "landing", "product", "general"],
  },
  {
    name: "Button",
    roleEn: "Primary or secondary action",
    roleNb: "Primær eller sekundær handling",
    whenEn: "One primary CTA per view (accent); others secondary.",
    whenNb: "Én primær CTA per visning (accent); andre sekundære.",
    category: "form",
    contexts: ["cta", "hero", "form", "general"],
  },
  {
    name: "CTA block",
    roleEn: "Conversion section with headline and button",
    roleNb: "Konverteringsseksjon med overskrift og knapp",
    whenEn: "Before footer or after value props; single clear action.",
    whenNb: "Før footer eller etter verdier; én tydelig handling.",
    category: "content",
    contexts: ["cta", "landing", "marketing", "general"],
  },
  {
    name: "RichText",
    roleEn: "Headings and body copy",
    roleNb: "Overskrifter og brødtekst",
    whenEn: "Value props, intro, or long-form content.",
    whenNb: "Verdier, intro eller langt innhold.",
    category: "content",
    contexts: ["features", "landing", "blog", "general"],
  },
  {
    name: "FAQ accordion",
    roleEn: "Expandable Q&A list",
    roleNb: "Utvidbar spørsmål og svar",
    whenEn: "4–8 questions; short answers; reduces support load.",
    whenNb: "4–8 spørsmål; korte svar; reduserer supportbelastning.",
    category: "content",
    contexts: ["faq", "landing", "product", "general"],
  },
  {
    name: "Testimonial / quote",
    roleEn: "Social proof quote or review",
    roleNb: "Sitat eller anmeldelse",
    whenEn: "2–4 testimonials; name, role, short quote.",
    whenNb: "2–4 anmeldelser; navn, rolle, kort sitat.",
    category: "content",
    contexts: ["features", "social_proof", "landing", "general"],
  },
  {
    name: "Input",
    roleEn: "Form field (text, email, etc.)",
    roleNb: "Skjemafelt (tekst, e-post, osv.)",
    whenEn: "Forms: contact, signup, search; always with label.",
    whenNb: "Skjemaer: kontakt, registrering, søk; alltid med etiketten.",
    category: "form",
    contexts: ["form", "general"],
  },
  {
    name: "Nav / tabs",
    roleEn: "Navigation or tab list",
    roleNb: "Navigasjon eller faner",
    whenEn: "Section switcher or main nav; max 5–7 items.",
    whenNb: "Seksjonsvelger eller hovednavigasjon; max 5–7 elementer.",
    category: "navigation",
    contexts: ["general"],
  },
  {
    name: "Link",
    roleEn: "Text or inline link",
    roleNb: "Tekstlenke eller inline-lenke",
    whenEn: "Secondary actions, footers, in-body links.",
    whenNb: "Sekundære handlinger, footer, lenker i teksten.",
    category: "navigation",
    contexts: ["general"],
  },
  {
    name: "Badge / pill",
    roleEn: "Label or status indicator",
    roleNb: "Etikett eller status",
    whenEn: "Status, category, or count; subtle style.",
    whenNb: "Status, kategori eller antall; diskret stil.",
    category: "feedback",
    contexts: ["general"],
  },
  {
    name: "Alert / message",
    roleEn: "Success, error, or info message",
    roleNb: "Suksess-, feil- eller infomelding",
    whenEn: "Form feedback or system messages; one at a time.",
    whenNb: "Skjemaretur eller systemmeldinger; én om gangen.",
    category: "feedback",
    contexts: ["form", "general"],
  },
];

function contextMatches(context: string, def: ComponentDef): boolean {
  const c = (context ?? "").trim().toLowerCase();
  if (!c || c === "general") return true;
  return def.contexts.some((ctx) => ctx === c || c.includes(ctx));
}

/**
 * Suggests components by context. Deterministic; no external calls.
 */
export function suggestComponents(input: SuggestComponentsInput): SuggestComponentsOutput {
  const context = (input.context ?? "").trim() || "general";
  const isEn = input.locale === "en";
  const limit =
    typeof input.limit === "number" && !Number.isNaN(input.limit) && input.limit > 0
      ? Math.min(Math.floor(input.limit), COMPONENTS.length)
      : COMPONENTS.length;

  const filtered = COMPONENTS.filter((def) => contextMatches(context, def)).slice(0, limit);

  const components: ComponentSuggestion[] = filtered.map((def) => ({
    name: def.name,
    role: isEn ? def.roleEn : def.roleNb,
    whenToUse: isEn ? def.whenEn : def.whenNb,
    category: def.category,
  }));

  const summary = isEn
    ? `${components.length} component(s) suggested for context "${context}".`
    : `${components.length} komponent(er) foreslått for kontekst «${context}».`;

  return {
    components,
    summary,
  };
}

export { suggestComponentsCapability, CAPABILITY_NAME };

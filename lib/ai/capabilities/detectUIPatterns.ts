/**
 * UI pattern detection engine capability: detectUIPatterns.
 * Detects composite UI patterns from a list of components/sections (types, roles, layout hints).
 * Returns pattern id, name, category, confidence, and involved components. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectUIPatterns";

const detectUIPatternsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "UI pattern detection engine: from a list of components or sections (type, role, layoutHint), detects composite UI patterns (e.g. landing_page, dashboard, form_flow, card_grid, list_detail). Returns pattern id, name, category, confidence, and componentsInvolved. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect UI patterns input",
    properties: {
      components: {
        type: "array",
        description: "Components or sections to analyze",
        items: {
          type: "object",
          required: ["type"],
          properties: {
            id: { type: "string" },
            type: { type: "string", description: "hero, cta_block, card_grid, form, sidebar, kpi_cards, etc." },
            role: { type: "string" },
            layoutHint: { type: "string", description: "full_width, contained, sidebar, grid_2col, etc." },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for labels" },
    },
    required: ["components"],
  },
  outputSchema: {
    type: "object",
    description: "Detected UI patterns result",
    required: ["detectedPatterns", "summary", "generatedAt"],
    properties: {
      detectedPatterns: {
        type: "array",
        items: {
          type: "object",
          required: ["patternId", "name", "category", "confidence", "componentsInvolved"],
          properties: {
            patternId: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            category: { type: "string" },
            confidence: { type: "number", description: "0-1" },
            componentsInvolved: { type: "array", items: { type: "string" } },
            suggestion: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is detection only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(detectUIPatternsCapability);

export type PatternComponentInput = {
  id?: string | null;
  type: string;
  role?: string | null;
  layoutHint?: string | null;
};

export type DetectUIPatternsInput = {
  components: PatternComponentInput[];
  locale?: "nb" | "en" | null;
};

export type DetectedPatternResult = {
  patternId: string;
  name: string;
  description?: string | null;
  category: string;
  confidence: number;
  componentsInvolved: string[];
  suggestion?: string | null;
};

export type DetectUIPatternsOutput = {
  detectedPatterns: DetectedPatternResult[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

type CompositePatternDef = {
  patternId: string;
  nameEn: string;
  nameNb: string;
  descEn: string;
  descNb: string;
  category: string;
  /** Required component type hints (any match); at least one must match. */
  requiredTypes: string[];
  /** Optional types that boost confidence. */
  optionalTypes: string[];
  /** Layout hints that strengthen match. */
  layoutHints: string[];
  minComponents: number;
};

const COMPOSITE_PATTERNS: CompositePatternDef[] = [
  {
    patternId: "landing_page",
    nameEn: "Landing page",
    nameNb: "Landingsside",
    descEn: "Marketing landing: hero, value props, social proof, CTA.",
    descNb: "Markedsføringslanding: hero, verdier, sosialt bevis, CTA.",
    category: "marketing",
    requiredTypes: ["hero"],
    optionalTypes: ["features", "feature_list", "card_grid", "testimonials", "cta", "cta_block", "faq", "accordion"],
    layoutHints: ["full_width", "contained"],
    minComponents: 2,
  },
  {
    patternId: "dashboard",
    nameEn: "Dashboard",
    nameNb: "Dashboard",
    descEn: "Dashboard: sidebar nav, header, KPI cards, main content area.",
    descNb: "Dashboard: sidemeny, header, KPI-kort, hovedområde.",
    category: "admin",
    requiredTypes: ["sidebar", "nav_vertical", "kpi_cards", "main", "header"],
    optionalTypes: ["table", "list", "card_list"],
    layoutHints: ["sidebar", "main", "grid_3col"],
    minComponents: 2,
  },
  {
    patternId: "form_flow",
    nameEn: "Form flow",
    nameNb: "Skjemaflyt",
    descEn: "Multi-step or single form with header and actions.",
    descNb: "Flerstegs- eller enkelt skjema med header og handlinger.",
    category: "form",
    requiredTypes: ["form", "form_control"],
    optionalTypes: ["progress_steps", "stepper", "header", "button_primary"],
    layoutHints: ["contained"],
    minComponents: 1,
  },
  {
    patternId: "card_grid",
    nameEn: "Card grid",
    nameNb: "Kortrute",
    descEn: "Grid of cards (features, products, or content).",
    descNb: "Rute med kort (funksjoner, produkter eller innhold).",
    category: "content",
    requiredTypes: ["card_grid", "feature_list", "card"],
    optionalTypes: [],
    layoutHints: ["contained", "grid_2col", "grid_3col"],
    minComponents: 1,
  },
  {
    patternId: "list_detail",
    nameEn: "List / detail",
    nameNb: "Liste / detalj",
    descEn: "List view with optional detail panel or drill-down.",
    descNb: "Listevisning med valgfritt detaljpanel eller nedlasting.",
    category: "content",
    requiredTypes: ["table", "list", "card_list"],
    optionalTypes: ["detail_view", "sidebar"],
    layoutHints: ["main", "sidebar"],
    minComponents: 1,
  },
  {
    patternId: "settings",
    nameEn: "Settings",
    nameNb: "Innstillinger",
    descEn: "Settings or config: grouped fields, save actions.",
    descNb: "Innstillinger eller konfig: grupperte felt, lagre-handlinger.",
    category: "admin",
    requiredTypes: ["form", "fieldset", "input"],
    optionalTypes: ["button_primary", "danger_zone"],
    layoutHints: ["contained"],
    minComponents: 1,
  },
  {
    patternId: "onboarding_stepper",
    nameEn: "Onboarding stepper",
    nameNb: "Onboarding-steg",
    descEn: "Onboarding or wizard: progress, step content, single CTA.",
    descNb: "Onboarding eller wizard: fremdrift, steginnhold, én CTA.",
    category: "conversion",
    requiredTypes: ["progress_steps", "stepper", "cta", "button_primary"],
    optionalTypes: ["hero", "headline"],
    layoutHints: ["contained"],
    minComponents: 2,
  },
  {
    patternId: "cta_focus",
    nameEn: "CTA focus",
    nameNb: "CTA-fokus",
    descEn: "Conversion-focused: hero + primary CTA or CTA block.",
    descNb: "Konverteringsfokus: hero + primær CTA eller CTA-blokk.",
    category: "conversion",
    requiredTypes: ["hero", "cta_block", "cta", "button_primary"],
    optionalTypes: [],
    layoutHints: ["full_width", "contained"],
    minComponents: 2,
  },
];

function typeMatches(componentType: string, required: string[]): boolean {
  const t = normalize(componentType);
  return required.some((r) => t.includes(normalize(r)) || normalize(r).includes(t));
}

function countMatches(types: string[], list: string[]): number {
  const set = new Set(types.map(normalize));
  return list.filter((r) => Array.from(set).some((t) => t.includes(normalize(r)) || normalize(r).includes(t))).length;
}

/**
 * Detects composite UI patterns from component list. Deterministic; no external calls.
 */
export function detectUIPatterns(input: DetectUIPatternsInput): DetectUIPatternsOutput {
  const components = Array.isArray(input.components) ? input.components : [];
  const isEn = input.locale === "en";

  const types = components.map((c) => safeStr(c.type)).filter(Boolean);
  const layoutHints = components.map((c) => safeStr(c.layoutHint)).filter(Boolean);
  const typeSet = new Set(types.map(normalize));
  const layoutSet = new Set(layoutHints.map(normalize));

  const detectedPatterns: DetectedPatternResult[] = [];

  for (const def of COMPOSITE_PATTERNS) {
    const requiredMatch = def.requiredTypes.some((r) => countMatches(types, [r]) > 0);
    if (!requiredMatch) continue;

    const requiredCount = countMatches(types, def.requiredTypes);
    const optionalCount = countMatches(types, def.optionalTypes);
    const layoutMatch = def.layoutHints.length === 0 || def.layoutHints.some((h) => layoutSet.has(normalize(h)));

    const totalComponents = components.length;
    if (totalComponents < def.minComponents) continue;

    let confidence = 0.4;
    if (requiredCount >= 1) confidence += 0.2 * Math.min(requiredCount, 3);
    if (optionalCount >= 1) confidence += 0.1 * Math.min(optionalCount, 3);
    if (layoutMatch) confidence += 0.15;
    if (totalComponents >= def.minComponents + 2) confidence += 0.1;
    confidence = Math.min(1, Math.round(confidence * 100) / 100);

    if (confidence < 0.5) continue;

    const involved = components
      .filter((c) => typeMatches(c.type, [...def.requiredTypes, ...def.optionalTypes]))
      .map((c) => c.id || c.type)
      .filter(Boolean);
    const componentsInvolved = involved.length > 0 ? involved : types.slice(0, 5);

    detectedPatterns.push({
      patternId: def.patternId,
      name: isEn ? def.nameEn : def.nameNb,
      description: isEn ? def.descEn : def.descNb,
      category: def.category,
      confidence,
      componentsInvolved: Array.from(new Set(componentsInvolved)),
      suggestion: isEn ? `Pattern "${def.patternId}" detected; ensure 1-3-1 and accessibility.` : `Mønster "${def.patternId}" oppdaget; sikre 1-3-1 og tilgjengelighet.`,
    });
  }

  detectedPatterns.sort((a, b) => b.confidence - a.confidence);

  const summary = isEn
    ? `Detected ${detectedPatterns.length} UI pattern(s) from ${components.length} component(s).`
    : `Oppdaget ${detectedPatterns.length} UI-mønster(e) fra ${components.length} komponent(er).`;

  return {
    detectedPatterns,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { detectUIPatternsCapability, CAPABILITY_NAME };

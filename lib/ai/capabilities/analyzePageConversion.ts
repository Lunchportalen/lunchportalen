/**
 * AI page conversion analyzer capability: analyzePageConversion.
 * Analyzes a page for conversion readiness: headline, CTA, value props, trust, friction.
 * Returns conversion score (0-100), signals, issues by dimension, and summary.
 * Deterministic; no LLM. Aligns with CRO page analysis concepts.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "analyzePageConversion";

const analyzePageConversionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes page conversion readiness: headline clarity, CTA clarity, value props, trust signals, and friction. Returns conversion score (0-100), signals per dimension, issues with suggestions, and summary. Uses page (title, meta, blocks) and optional conversion goal. Deterministic; no LLM.",
  requiredContext: ["page"],
  inputSchema: {
    type: "object",
    description: "Analyze page conversion input",
    properties: {
      page: {
        type: "object",
        description: "Page to analyze (title, meta, blocks)",
        properties: {
          title: { type: "string" },
          meta: { type: "object", properties: { description: { type: "string" } } },
          blocks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                data: { type: "object" },
              },
            },
          },
        },
      },
      conversionGoal: { type: "string", description: "Optional: lead, demo, contact, signup, quote" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["page"],
  },
  outputSchema: {
    type: "object",
    description: "Page conversion analysis result",
    required: ["conversionScore", "signals", "issues", "summary"],
    properties: {
      conversionScore: { type: "number", description: "0-100 (higher = better for conversion)" },
      signals: {
        type: "object",
        description: "Conversion signals per dimension",
        properties: {
          headlineClarity: { type: "string", description: "missing | weak | clear" },
          primaryCtaClarity: { type: "string", description: "none | weak | clear" },
          hasValueProps: { type: "boolean" },
          hasHero: { type: "boolean" },
          ctaCount: { type: "number" },
          introWordCount: { type: "number" },
          trustMentions: { type: "number" },
          frictionFlags: { type: "object", properties: { introTooShort: { type: "boolean" }, longParagraphCount: { type: "number" } } },
        },
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          required: ["code", "message", "suggestion", "priority", "dimension"],
          properties: {
            code: { type: "string" },
            message: { type: "string" },
            suggestion: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
            dimension: { type: "string", description: "headline | cta | value_props | trust | friction | structure" },
            blockId: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(analyzePageConversionCapability);

export type AnalyzePageConversionPageInput = {
  title?: string | null;
  meta?: { description?: string | null } | null;
  blocks?: Array<{ id: string; type?: string | null; data?: Record<string, unknown> | null }> | null;
};

export type AnalyzePageConversionInput = {
  page: AnalyzePageConversionPageInput;
  conversionGoal?: string | null;
  locale?: "nb" | "en" | null;
};

export type ConversionSignals = {
  headlineClarity: "missing" | "weak" | "clear";
  primaryCtaClarity: "none" | "weak" | "clear";
  hasValueProps: boolean;
  hasHero: boolean;
  ctaCount: number;
  introWordCount: number;
  trustMentions: number;
  frictionFlags: { introTooShort: boolean; longParagraphCount: number };
};

export type ConversionIssue = {
  code: string;
  message: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
  dimension: "headline" | "cta" | "value_props" | "trust" | "friction" | "structure";
  blockId?: string | null;
};

export type AnalyzePageConversionOutput = {
  conversionScore: number;
  signals: ConversionSignals;
  issues: ConversionIssue[];
  summary: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function wordCount(text: string): number {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

const GENERIC_CTA = [
  "submit", "send", "klikk", "les mer", "read more", "klikk her", "click here",
  "ok", "send inn", "submit form",
];

const VALUE_PHRASES = ["fordeler", "benefits", "hvorfor", "why", "verdi", "value", "derfor"];
const TRUST_PHRASES = [
  "sikkerhet", "security", "compliance", "esg", "bærekraft", "sustainability",
  "kontroll", "control", "sporbarhet", "traceability", "personvern", "privacy", "gdpr",
];

const INTRO_MIN_WORDS = 30;
const LONG_PARAGRAPH_WORDS = 200;

/**
 * Analyzes page conversion readiness. Deterministic; no external calls.
 */
export function analyzePageConversion(input: AnalyzePageConversionInput): AnalyzePageConversionOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const page = input.page && typeof input.page === "object" ? input.page : { title: "", meta: {}, blocks: [] };
  const blocks = Array.isArray(page.blocks)
    ? page.blocks.filter(
        (b): b is { id: string; type?: string | null; data?: Record<string, unknown> | null } =>
          b != null && typeof b === "object" && typeof (b as { id?: unknown }).id === "string"
      )
    : [];

  const issues: ConversionIssue[] = [];
  const types = blocks.map((b) => (b.type ?? "").trim().toLowerCase());

  const heroBlock = blocks.find((b) => (b.type ?? "").trim().toLowerCase() === "hero");
  const heroTitle = heroBlock?.data && typeof heroBlock.data.title === "string" ? str(heroBlock.data.title) : str(heroBlock?.data?.heading);
  const firstRich = blocks.find((b) => (b.type ?? "").trim().toLowerCase() === "richtext");
  const firstHeading = firstRich?.data && typeof firstRich.data.heading === "string" ? str(firstRich.data.heading) : "";
  const mainHeadline = heroTitle || firstHeading || str(page.title);

  let headlineClarity: ConversionSignals["headlineClarity"] = "missing";
  if (mainHeadline.length >= 20) headlineClarity = "clear";
  else if (mainHeadline.length >= 10) headlineClarity = "weak";
  else if (mainHeadline.length > 0) headlineClarity = "weak";

  const ctaBlocks = blocks.filter((b) => (b.type ?? "").trim().toLowerCase() === "cta");
  const ctaCount = ctaBlocks.length;
  const firstCta = ctaBlocks[0];
  const ctaButtonLabel = firstCta?.data && typeof firstCta.data.buttonLabel === "string" ? str(firstCta.data.buttonLabel) : str(firstCta?.data?.ctaLabel);
  const ctaTitle = firstCta?.data && typeof firstCta.data.title === "string" ? str(firstCta.data.title) : "";

  let primaryCtaClarity: ConversionSignals["primaryCtaClarity"] = "none";
  if (ctaCount > 0) {
    const generic = GENERIC_CTA.some((g) => ctaButtonLabel.toLowerCase().includes(g));
    primaryCtaClarity = !ctaButtonLabel || generic ? "weak" : "clear";
  }

  let bodyContent = "";
  let introWordCount = 0;
  let longParagraphCount = 0;
  for (const b of blocks) {
    const data = b.data && typeof b.data === "object" ? b.data : {};
    const body = str(data.body ?? "");
    if (body) {
      bodyContent += " " + body;
      if (introWordCount === 0 && ((b.type ?? "").trim().toLowerCase() === "richtext")) {
        introWordCount = wordCount(body);
      }
      if (wordCount(body) >= LONG_PARAGRAPH_WORDS) longParagraphCount += 1;
    }
  }
  bodyContent = bodyContent.trim();
  const bodyLower = bodyContent.toLowerCase();
  const hasValueProps = VALUE_PHRASES.some((p) => bodyLower.includes(p));
  const trustMentions = TRUST_PHRASES.filter((p) => bodyLower.includes(p)).length;
  const introTooShort = introWordCount > 0 && introWordCount < INTRO_MIN_WORDS;

  if (headlineClarity === "missing") {
    issues.push({
      code: "headline_missing",
      message: isEn ? "No clear headline; hero or first section needs a title." : "Ingen tydelig overskrift; hero eller første seksjon trenger en tittel.",
      suggestion: isEn ? "Add a hero title or first richText heading (20–60 chars)." : "Legg til hero-tittel eller første richText-overskrift (20–60 tegn).",
      priority: "high",
      dimension: "headline",
    });
  } else if (headlineClarity === "weak") {
    issues.push({
      code: "headline_weak",
      message: isEn ? "Headline is short or vague; aim for 20–60 characters." : "Overskriften er kort eller vag; sikt på 20–60 tegn.",
      suggestion: isEn ? "Clarify value or outcome in the main headline." : "Tydeliggjør verdi eller resultat i hovedoverskriften.",
      priority: "medium",
      dimension: "headline",
    });
  }

  if (primaryCtaClarity === "none") {
    issues.push({
      code: "cta_missing",
      message: isEn ? "Page has no CTA; users need a clear next step." : "Siden har ingen CTA; brukere trenger et tydelig neste steg.",
      suggestion: isEn ? "Add a CTA block with specific action (e.g. Request demo, Contact)." : "Legg til en CTA-blokk med konkret handling (f.eks. Be om demo, Kontakt).",
      priority: "high",
      dimension: "cta",
    });
  } else if (primaryCtaClarity === "weak") {
    issues.push({
      code: "cta_weak",
      message: isEn ? "CTA label is generic; action-specific copy converts better." : "CTA-etikett er generisk; handlingsspesifikk tekst konverterer bedre.",
      suggestion: isEn ? "Use e.g. Request demo, Contact us, Get a quote." : "Bruk f.eks. Be om demo, Kontakt oss, Få tilbud.",
      priority: "high",
      dimension: "cta",
      blockId: firstCta?.id,
    });
  }

  if (blocks.length >= 3 && !hasValueProps) {
    issues.push({
      code: "value_props_missing",
      message: isEn ? "No clear value-proposition language; benefits/why help conversion." : "Ingen tydelig verdiforslag; fordeler/hvorfor hjelper konvertering.",
      suggestion: isEn ? "Add a section with benefits, value, or why choose you." : "Legg til en seksjon med fordeler, verdi eller hvorfor velge dere.",
      priority: "medium",
      dimension: "value_props",
    });
  }

  if (introTooShort && firstRich) {
    issues.push({
      code: "intro_too_short",
      message: isEn ? `First content block has few words (${introWordCount}); aim for ${INTRO_MIN_WORDS}+.` : `Første innholdsblokk har få ord (${introWordCount}); sikt på ${INTRO_MIN_WORDS}+.`,
      suggestion: isEn ? "Expand the intro with a clear value statement or context." : "Utvid introen med et tydelig verdiberegning eller kontekst.",
      priority: "low",
      dimension: "friction",
      blockId: firstRich.id,
    });
  }

  if (longParagraphCount >= 2) {
    issues.push({
      code: "long_paragraphs",
      message: isEn ? `${longParagraphCount} section(s) have very long text; may increase friction.` : `${longParagraphCount} seksjon(er) har veldig lang tekst; kan øke friksjon.`,
      suggestion: isEn ? "Break into shorter paragraphs or add subheadings." : "Del opp i kortere avsnitt eller legg til underoverskrifter.",
      priority: "low",
      dimension: "friction",
    });
  }

  const hasHero = types.includes("hero");
  if (!hasHero && blocks.length > 0) {
    issues.push({
      code: "no_hero",
      message: isEn ? "No hero block; first impression and headline clarity matter for conversion." : "Ingen hero-blokk; første inntrykk og overskrift tydelighet teller for konvertering.",
      suggestion: isEn ? "Add a hero at the top with headline and primary CTA." : "Legg til en hero øverst med overskrift og primær CTA.",
      priority: "medium",
      dimension: "structure",
    });
  }

  if (ctaCount > 2) {
    issues.push({
      code: "multiple_ctas",
      message: isEn ? "Several CTAs can dilute focus; one primary CTA often converts better." : "Flere CTA-er kan fortynne fokus; én primær CTA konverterer ofte bedre.",
      suggestion: isEn ? "Keep one primary CTA; use secondary actions sparingly." : "Behold én primær CTA; bruk sekundære handlinger sparsomt.",
      priority: "low",
      dimension: "structure",
    });
  }

  const deduction = issues.length * 12;
  const conversionScore = Math.max(0, Math.min(100, 100 - deduction));

  const summary = isEn
    ? `Conversion score: ${conversionScore}/100. Headline ${headlineClarity}, CTA ${primaryCtaClarity}, value props ${hasValueProps ? "yes" : "no"}. ${issues.length} issue(s).`
    : `Konverteringsscore: ${conversionScore}/100. Overskrift ${headlineClarity}, CTA ${primaryCtaClarity}, verdiargumenter ${hasValueProps ? "ja" : "nei"}. ${issues.length} problem(er).`;

  return {
    conversionScore,
    signals: {
      headlineClarity,
      primaryCtaClarity,
      hasValueProps,
      hasHero,
      ctaCount,
      introWordCount,
      trustMentions,
      frictionFlags: { introTooShort, longParagraphCount },
    },
    issues,
    summary,
  };
}

export { analyzePageConversionCapability, CAPABILITY_NAME };

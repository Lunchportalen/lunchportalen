/**
 * Block conversion optimizer capability: optimizeBlockForConversion.
 * Analyzes a single block (hero, richText, cta, image, form) for conversion and returns
 * a conversion score, suggestions, and optional optimized data. Deterministic; no LLM.
 * Aligns with 1-3-1, one primary action, calm tone. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "optimizeBlockForConversion";

const optimizeBlockForConversionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Optimizes a block for conversion: conversion score (0-100), suggestions (headline length, CTA clarity, one primary action, trust), and optional optimized data. Supports hero, richText, cta, image, form. Deterministic; no LLM.",
  requiredContext: ["block"],
  inputSchema: {
    type: "object",
    description: "Optimize block for conversion input",
    properties: {
      block: {
        type: "object",
        description: "Block to optimize (id, type, data)",
        properties: {
          id: { type: "string" },
          type: { type: "string", description: "hero, richText, cta, image, form" },
          data: { type: "object" },
        },
      },
      conversionGoal: { type: "string", description: "Optional: signup, lead, demo, contact, subscribe" },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["block"],
  },
  outputSchema: {
    type: "object",
    description: "Block conversion optimization result",
    required: ["conversionScore", "suggestions", "summary"],
    properties: {
      conversionScore: { type: "number", description: "0-100 (higher = better for conversion)" },
      suggestions: {
        type: "array",
        items: {
          type: "object",
          required: ["field", "issue", "suggestion", "priority"],
          properties: {
            field: { type: "string" },
            issue: { type: "string" },
            suggestion: { type: "string" },
            priority: { type: "string", description: "high | medium | low" },
            suggestedValue: { type: "string", description: "Optional replacement" },
          },
        },
      },
      optimizedData: {
        type: "object",
        description: "Optional: suggested data keys/values to apply",
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions and optional optimized data; no content mutation unless applied by caller.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(optimizeBlockForConversionCapability);

export type OptimizeBlockForConversionBlockInput = {
  id: string;
  type?: string | null;
  data?: Record<string, unknown> | null;
};

export type OptimizeBlockForConversionInput = {
  block: OptimizeBlockForConversionBlockInput;
  conversionGoal?: string | null;
  locale?: "nb" | "en" | null;
};

export type ConversionSuggestion = {
  field: string;
  issue: string;
  suggestion: string;
  priority: "high" | "medium" | "low";
  suggestedValue?: string | null;
};

export type OptimizeBlockForConversionOutput = {
  conversionScore: number;
  suggestions: ConversionSuggestion[];
  optimizedData?: Record<string, unknown> | null;
  summary: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const HEADLINE_MIN = 10;
const HEADLINE_IDEAL_MIN = 20;
const HEADLINE_IDEAL_MAX = 60;
const HEADLINE_MAX = 80;

const GENERIC_CTA = [
  "klikk her", "click here", "submit", "send", "les mer", "read more",
  "klikk", "send inn", "submit form", "ok", "send",
];

function isGenericCta(text: string): boolean {
  const t = text.toLowerCase().trim();
  return GENERIC_CTA.some((p) => t === p || t.includes(p));
}

function scoreHeadline(headline: string): number {
  const len = headline.length;
  if (len < HEADLINE_MIN) return Math.max(0, 20 + len);
  if (len > HEADLINE_MAX) return Math.max(30, 70 - (len - HEADLINE_MAX));
  if (len >= HEADLINE_IDEAL_MIN && len <= HEADLINE_IDEAL_MAX) return 95;
  return 75;
}

/**
 * Optimizes a block for conversion. Deterministic; no external calls.
 */
export function optimizeBlockForConversion(input: OptimizeBlockForConversionInput): OptimizeBlockForConversionOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const block = input.block && typeof input.block === "object" ? input.block : { id: "", type: "", data: {} };
  const data = block.data && typeof block.data === "object" && !Array.isArray(block.data) ? (block.data as Record<string, unknown>) : {};
  const type = (block.type ?? "").trim().toLowerCase();

  const suggestions: ConversionSuggestion[] = [];
  let totalScore = 0;
  let weightCount = 0;

  function add(field: string, issue: string, suggestion: string, priority: ConversionSuggestion["priority"], suggestedValue?: string | null) {
    suggestions.push({
      field,
      issue,
      suggestion,
      priority,
      ...(suggestedValue != null ? { suggestedValue } : {}),
    });
  }

  if (type === "hero") {
    const title = str(data.title ?? data.heading ?? "");
    const subtitle = str(data.subtitle ?? data.text ?? "");
    const ctaLabel = str(data.ctaLabel ?? "");
    const ctaHref = str(data.ctaHref ?? "");

    const headlineScore = scoreHeadline(title);
    totalScore += headlineScore;
    weightCount += 1;

    if (title.length < HEADLINE_MIN) {
      add(
        "title",
        isEn ? "Headline too short; may not communicate value." : "Overskrift for kort; kommuniserer kanskje ikke verdi.",
        isEn ? `Aim for ${HEADLINE_IDEAL_MIN}-${HEADLINE_IDEAL_MAX} characters for clarity and impact.` : `Sikt på ${HEADLINE_IDEAL_MIN}-${HEADLINE_IDEAL_MAX} tegn for tydelighet og slagkraft.`,
        "high",
        title || (isEn ? "Your headline here" : "Din overskrift her")
      );
    } else if (title.length > HEADLINE_IDEAL_MAX && title.length <= HEADLINE_MAX) {
      add(
        "title",
        isEn ? "Headline may be long; shorter often converts better." : "Overskriften kan være lang; kortere konverterer ofte bedre.",
        isEn ? `Consider shortening to around ${HEADLINE_IDEAL_MAX} characters.` : `Vurder å forkorte til rundt ${HEADLINE_IDEAL_MAX} tegn.`,
        "medium"
      );
    } else if (title.length > HEADLINE_MAX) {
      add(
        "title",
        isEn ? "Headline is long; risk of losing attention." : "Overskriften er lang; risiko for å miste oppmerksomhet.",
        isEn ? `Shorten to under ${HEADLINE_MAX} characters.` : `Forkort til under ${HEADLINE_MAX} tegn.`,
        "high"
      );
    }

    if (!ctaLabel) {
      totalScore += 30;
      weightCount += 1;
      add(
        "ctaLabel",
        isEn ? "No primary CTA; users need one clear action." : "Ingen primær CTA; brukere trenger én tydelig handling.",
        isEn ? "Add one primary CTA (e.g. Request demo, Contact)." : "Legg til én primær CTA (f.eks. Be om demo, Kontakt).",
        "high",
        isEn ? "Request demo" : "Be om demo"
      );
    } else {
      if (isGenericCta(ctaLabel)) {
        totalScore += 40;
        weightCount += 1;
        add(
          "ctaLabel",
          isEn ? "Generic CTA; action-specific copy converts better." : "Generisk CTA; handlingsspesifikk tekst konverterer bedre.",
          isEn ? "Use a specific action (e.g. Request demo, Get a quote)." : "Bruk en konkret handling (f.eks. Be om demo, Få tilbud).",
          "high",
          isEn ? "Request demo" : "Be om demo"
        );
      } else {
        totalScore += 90;
        weightCount += 1;
      }
      if (!ctaHref) {
        add(
          "ctaHref",
          isEn ? "CTA has no link; button will not lead anywhere." : "CTA har ingen lenke; knappen fører ikke noe sted.",
          isEn ? "Set ctaHref to the target page or anchor." : "Sett ctaHref til målside eller anker.",
          "high"
        );
      }
    }

    if (!subtitle && title) {
      add(
        "subtitle",
        isEn ? "A short subtitle can reinforce the headline." : "En kort undertekst kan forsterke overskriften.",
        isEn ? "Add one line of support or benefit." : "Legg til én linje med støtte eller fordel.",
        "low"
      );
    }
  }

  if (type === "richtext" || type === "richText") {
    const heading = str(data.heading ?? data.title ?? "");
    const body = str(data.body ?? "");

    if (body.length > 0) {
      totalScore += Math.min(90, 50 + Math.min(body.length / 20, 40));
      weightCount += 1;
    } else {
      totalScore += 30;
      weightCount += 1;
      add(
        "body",
        isEn ? "Empty body; add clear, scannable content." : "Tom brødtekst; legg til tydelig, skanbart innhold.",
        isEn ? "First sentence should state the main point." : "Første setning bør si hovedpoenget.",
        "high"
      );
    }

    if (body.length > 800 && !heading) {
      add(
        "heading",
        isEn ? "Long section without heading; add a scannable heading." : "Lang seksjon uten overskrift; legg til en skanbar overskrift.",
        isEn ? "Helps scanning and conversion clarity." : "Hjelper skanning og konverteringsklarhet.",
        "medium"
      );
    }
  }

  if (type === "cta") {
    const title = str(data.title ?? "");
    const buttonLabel = str(data.buttonLabel ?? data.ctaLabel ?? "");
    const buttonHref = str(data.buttonHref ?? data.ctaHref ?? data.href ?? "");

    if (!buttonLabel) {
      totalScore += 35;
      weightCount += 1;
      add(
        "buttonLabel",
        isEn ? "No button label; CTA is invisible." : "Ingen knappetekst; CTA er usynlig.",
        isEn ? "Use one clear action (e.g. Contact us, Request demo)." : "Bruk én tydelig handling (f.eks. Kontakt oss, Be om demo).",
        "high",
        isEn ? "Contact us" : "Kontakt oss"
      );
    } else {
      if (isGenericCta(buttonLabel)) {
        totalScore += 45;
        weightCount += 1;
        add(
          "buttonLabel",
          isEn ? "Generic CTA; use action-specific label." : "Generisk CTA; bruk handlingsspesifikk etiketten.",
          isEn ? "E.g. Request demo, Get a quote, Book a call." : "F.eks. Be om demo, Få tilbud, Book et møte.",
          "high",
          isEn ? "Request demo" : "Be om demo"
        );
      } else {
        totalScore += 90;
        weightCount += 1;
      }
    }

    if (!buttonHref) {
      add(
        "buttonHref",
        isEn ? "Button has no link." : "Knappen har ingen lenke.",
        isEn ? "Set buttonHref (or href) to target URL." : "Sett buttonHref (eller href) til mål-URL.",
        "high"
      );
    }

    if (!title && buttonLabel) {
      add(
        "title",
        isEn ? "A short title above the button can increase clicks." : "En kort tittel over knappen kan øke klikk.",
        isEn ? "E.g. Ready to get started?" : "F.eks. Klar for å komme i gang?",
        "low"
      );
    }
  }

  if (type === "image") {
    const alt = str(data.alt ?? data.imageAlt ?? "");
    if (!alt) {
      totalScore += 50;
      weightCount += 1;
      add(
        "alt",
        isEn ? "Missing alt text; add for accessibility and context." : "Mangler alt-tekst; legg til for tilgjengelighet og kontekst.",
        isEn ? "Describe the image briefly." : "Beskriv bildet kort.",
        "medium"
      );
    } else {
      totalScore += 85;
      weightCount += 1;
    }
  }

  if (type === "form") {
    const formId = str(data.formId ?? "");
    const title = str(data.title ?? "");
    if (!formId) {
      totalScore += 20;
      weightCount += 1;
      add(
        "formId",
        isEn ? "Form block has no formId; form will not render." : "Skjemablokk mangler formId; skjema vises ikke.",
        isEn ? "Set formId to the form key from backoffice." : "Sett formId til skjemanøkkel fra backoffice.",
        "high"
      );
    } else {
      totalScore += 80;
      weightCount += 1;
    }
    if (!title) {
      add(
        "title",
        isEn ? "Optional title can set expectations and improve completion." : "Valgfri tittel kan sette forventninger og forbedre fullføring.",
        isEn ? "E.g. Request a demo" : "F.eks. Be om demo",
        "low"
      );
    }
  }

  if (type && !["hero", "richtext", "cta", "image", "form"].includes(type)) {
    totalScore += 50;
    weightCount += 1;
    add(
      "type",
      isEn ? `Block type "${type}" has no conversion rules defined.` : `Blokktype "${type}" har ingen konverteringsregler definert.`,
      isEn ? "Optimization applies to hero, richText, cta, image, form." : "Optimalisering gjelder hero, richText, cta, image, form.",
      "low"
    );
  }

  const conversionScore =
    weightCount > 0 ? Math.round(Math.max(0, Math.min(100, totalScore / weightCount))) : 50;

  const summary = isEn
    ? `Conversion score: ${conversionScore}/100. ${suggestions.length} suggestion(s).`
    : `Konverteringsscore: ${conversionScore}/100. ${suggestions.length} forslag.`;

  const optimizedData: Record<string, unknown> = {};
  for (const s of suggestions) {
    if (s.suggestedValue != null && s.suggestedValue !== "" && s.field) {
      const key = s.field === "ctaLabel" ? "ctaLabel" : s.field === "buttonLabel" ? "buttonLabel" : s.field;
      optimizedData[key] = s.suggestedValue;
    }
  }

  return {
    conversionScore,
    suggestions,
    ...(Object.keys(optimizedData).length > 0 ? { optimizedData } : {}),
    summary,
  };
}

export { optimizeBlockForConversionCapability, CAPABILITY_NAME };

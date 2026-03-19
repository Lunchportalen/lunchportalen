/**
 * Automatic UX improvement suggestions capability: suggestUXFixes.
 * Suggests UX fixes from layout/block context: hierarchy, spacing, CTA, navigation,
 * forms, accessibility, contrast, clarity. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "suggestUXFixes";

const suggestUXFixesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Automatic UX improvement suggestions: from layout description and/or blocks, suggests fixes for hierarchy, spacing, CTA, navigation, form, accessibility (touch targets, contrast), clarity, and flow. Returns category, priority, suggestion, and optional target. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Suggest UX fixes input",
    properties: {
      layoutDescription: {
        type: "string",
        description: "Optional text describing the current layout or page",
      },
      blocks: {
        type: "array",
        description: "Optional current blocks (id, type) to derive UX context",
        items: {
          type: "object",
          properties: { id: { type: "string" }, type: { type: "string" } },
        },
      },
      device: {
        type: "string",
        description: "Optional: mobile | desktop | both (default: both)",
        enum: ["mobile", "desktop", "both"],
      },
      focus: {
        type: "string",
        description: "Optional: conversion | accessibility | clarity | all",
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
      maxFixes: { type: "number", description: "Max fixes to return (default: 10)" },
    },
    required: [],
  },
  outputSchema: {
    type: "object",
    description: "UX fix suggestions",
    required: ["fixes", "summary", "suggestedAt"],
    properties: {
      fixes: {
        type: "array",
        items: {
          type: "object",
          required: ["category", "priority", "suggestion", "target"],
          properties: {
            category: {
              type: "string",
              description: "hierarchy | spacing | cta | navigation | form | accessibility | contrast | clarity | flow",
            },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            suggestion: { type: "string" },
            target: { type: "string", description: "e.g. hero, form, global, header" },
            rationale: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      suggestedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is improvement suggestions only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(suggestUXFixesCapability);

export type SuggestUXFixesInput = {
  layoutDescription?: string | null;
  blocks?: Array<{ id?: string | null; type?: string | null }> | null;
  device?: "mobile" | "desktop" | "both" | null;
  focus?: string | null;
  locale?: "nb" | "en" | null;
  maxFixes?: number | null;
};

export type UXFixCategory =
  | "hierarchy"
  | "spacing"
  | "cta"
  | "navigation"
  | "form"
  | "accessibility"
  | "contrast"
  | "clarity"
  | "flow";

export type UXFix = {
  category: UXFixCategory;
  priority: "high" | "medium" | "low";
  suggestion: string;
  target: string;
  rationale?: string | null;
};

export type SuggestUXFixesOutput = {
  fixes: UXFix[];
  summary: string;
  suggestedAt: string;
};

const DEFAULT_MAX_FIXES = 10;

/**
 * Suggests UX fixes from layout/block context. Deterministic; no external calls.
 */
export function suggestUXFixes(input: SuggestUXFixesInput = {}): SuggestUXFixesOutput {
  const desc = (input.layoutDescription ?? "").toLowerCase().trim();
  const blocks = Array.isArray(input.blocks) ? input.blocks : [];
  const types = blocks.map((b) => (b?.type ?? "").toLowerCase()).filter(Boolean);
  const device = input.device === "mobile" || input.device === "desktop" ? input.device : "both";
  const focus = (input.focus ?? "all").toLowerCase();
  const maxFixes = Math.min(20, Math.max(1, Math.floor(Number(input.maxFixes) ?? DEFAULT_MAX_FIXES)));
  const isEn = input.locale === "en";

  const hasHero = types.includes("hero");
  const hasCta = types.includes("cta");
  const hasForm = types.includes("form");
  const hasRichText = types.includes("richtext") || types.includes("richText");
  const blockCount = types.length;
  const descHasCta = /\bcta\b|call to action|knapp|button/i.test(desc);
  const descNoHero = !hasHero && (desc.length === 0 || !/\bhero\b|banner|overskrift/i.test(desc));
  const descLongRun = /long|many text|several paragraph|lang rekke/i.test(desc);

  const fixes: UXFix[] = [];

  const add = (
    category: UXFixCategory,
    priority: "high" | "medium" | "low",
    suggestion: string,
    target: string,
    rationale?: string
  ) => {
    if (fixes.length >= maxFixes) return;
    if (focus !== "all" && focus !== category) return;
    fixes.push({ category, priority, suggestion, target, rationale: rationale ?? undefined });
  };

  if (descNoHero || (!hasHero && blockCount > 0)) {
    add(
      "hierarchy",
      "high",
      isEn
        ? "Add a clear hero or headline block at the top so users immediately understand the page purpose."
        : "Legg til en tydelig hero eller overskrift-blokk øverst slik at brukere raskt forstår sidens formål.",
      "global",
      isEn ? "One clear H1 and value prop improve scanning and conversion." : "Én tydelig H1 og verdiforslag forbedrer skanning og konvertering."
    );
  }

  if (!hasCta && !descHasCta) {
    add(
      "cta",
      "high",
      isEn
        ? "Add a primary CTA block (e.g. above the fold or after the main content) so users have a clear next step."
        : "Legg til en primær CTA-blokk (f.eks. over fold eller etter hovedinnhold) slik at brukere har et tydelig neste steg.",
      "global",
      isEn ? "Clear primary action increases conversions." : "Tydelig primær handling øker konverteringer."
    );
  }

  if (hasForm) {
    add(
      "form",
      "medium",
      isEn
        ? "Keep forms short: only essential fields above the fold; optional fields in a second step or collapsed."
        : "Hold skjemaer korte: kun nødvendige felt over fold; valgfrie felt i andre steg eller sammenklappet.",
      "form",
      isEn ? "Shorter forms reduce friction and drop-off." : "Kortere skjemaer reduserer friksjon og frafall."
    );
    add(
      "accessibility",
      "medium",
      isEn
        ? "Ensure form labels are associated with inputs; use visible focus styles and sufficient touch target size (min 44px)."
        : "Sikre at skjemamerkelapper er koblet til felt; bruk synlig fokus-stil og tilstrekkelig touch-mål (min 44px).",
      "form",
      isEn ? "Accessible forms improve completion and compliance." : "Tilgjengelige skjemaer forbedrer fullføring og compliance."
    );
  }

  if (device === "mobile" || device === "both") {
    add(
      "accessibility",
      "high",
      isEn
        ? "On mobile, ensure touch targets are at least 44×44px and primary actions are reachable without horizontal scroll."
        : "På mobil: sikre at touch-mål er minst 44×44px og at primærhandlinger er tilgjengelige uten horisontal scroll.",
      "global",
      isEn ? "WCAG and usability best practice for mobile." : "WCAG og brukervennlighet for mobil."
    );
  }

  add(
    "contrast",
    "medium",
    isEn
      ? "Ensure text has sufficient contrast (e.g. 4.5:1 for body text); avoid low-contrast buttons or links."
      : "Sikre at tekst har tilstrekkelig kontrast (f.eks. 4.5:1 for brødtekst); unngå lavkontrast-knapper eller lenker.",
    "global",
    isEn ? "Contrast supports readability and accessibility." : "Kontrast støtter lesbarhet og tilgjengelighet."
  );

  if (blockCount >= 4 && hasRichText) {
    add(
      "spacing",
      "medium",
      isEn
        ? "Use consistent spacing between sections (e.g. same padding/margin scale) so the page breathes and hierarchy is clear."
        : "Bruk konsekvent avstand mellom seksjoner (f.eks. samme padding/margin-skala) slik at siden puster og hierarki er tydelig.",
      "global",
      isEn ? "Consistent spacing improves scanability." : "Konsekvent avstand forbedrer skanbarhet."
    );
  }

  if (descLongRun || (hasRichText && blockCount >= 3)) {
    add(
      "flow",
      "medium",
      isEn
        ? "Break long text runs with subheadings, bullets, or a divider; add a CTA or link to maintain engagement."
        : "Bryt lange tekstrekker med underoverskrifter, punkter eller skillelinje; legg til CTA eller lenke for å holde engasjement.",
      "content",
      isEn ? "Chunking improves comprehension and scroll." : "Inndeling forbedrer forståelse og scrolling."
    );
  }

  add(
    "navigation",
    "low",
    isEn
      ? "Ensure primary navigation is visible and consistent; avoid more than 5–7 top-level items to reduce cognitive load."
      : "Sikre at primær navigasjon er synlig og konsistent; unngå mer enn 5–7 toppnivå-elementer for å redusere kognitiv belastning.",
    "header",
    isEn ? "Clear nav supports wayfinding." : "Tydelig navigasjon støtter veivisning."
  );

  add(
    "clarity",
    "medium",
    isEn
      ? "Use one primary action per section or screen; de-emphasize secondary actions so the next step is obvious."
      : "Bruk én primær handling per seksjon eller skjerm; nedton sekundære handlinger slik at neste steg er åpenbart.",
    "global",
    isEn ? "Single primary action reduces confusion." : "Én primær handling reduserer forvirring."
  );

  const out = fixes.slice(0, maxFixes);
  const summary = isEn
    ? `Suggested ${out.length} UX fix(es). Prioritize high-impact items (hierarchy, CTA, accessibility).`
    : `Foreslått ${out.length} UX-forbedring(er). Prioriter høyt påvirkning (hierarki, CTA, tilgjengelighet).`;

  return {
    fixes: out,
    summary,
    suggestedAt: new Date().toISOString(),
  };
}

export { suggestUXFixesCapability, CAPABILITY_NAME };

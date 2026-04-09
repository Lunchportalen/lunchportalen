/**
 * Autonomous CTA optimizer capability: autoImproveCTAs.
 * Scans multiple CTAs (e.g. from a page or site), prioritizes improvements, suggests
 * higher-converting variants per CTA, and optional placement/hierarchy hints.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "autoImproveCTAs";

const autoImproveCTAsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Autonomous CTA optimizer: analyzes multiple CTAs (label, context), prioritizes which to improve, suggests higher-converting variants per CTA, and optional placement/hierarchy hints. Returns improvements (priority, suggestedVariants, rationale) and an action plan. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Auto-improve CTAs input",
    properties: {
      ctas: {
        type: "array",
        description: "CTAs to analyze: [{ id?, label, context? (hero|mid|footer|unknown), positionInPage? }]",
        items: {
          type: "object",
          required: ["label"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            context: { type: "string", description: "hero | mid | footer | unknown" },
            positionInPage: { type: "number", description: "0-based order on page" },
          },
        },
      },
      conversionGoal: {
        type: "string",
        description: "Optional primary conversion (e.g. signup, lead, contact)",
      },
      locale: { type: "string", description: "Locale (nb | en)" },
      maxVariantsPerCta: { type: "number", description: "Max suggested variants per CTA (default: 3)" },
    },
    required: ["ctas"],
  },
  outputSchema: {
    type: "object",
    description: "Autonomous CTA improvement result",
    required: ["improvements", "actionPlan", "summary", "optimizedAt"],
    properties: {
      improvements: {
        type: "array",
        items: {
          type: "object",
          required: ["ctaRef", "priority", "currentLabel", "suggestedVariants", "rationale"],
          properties: {
            ctaRef: { type: "string", description: "id or label reference" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            currentLabel: { type: "string" },
            suggestedVariants: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  buttonLabel: { type: "string" },
                  title: { type: "string" },
                },
              },
            },
            rationale: { type: "string" },
            placementHint: { type: "string" },
          },
        },
      },
      actionPlan: {
        type: "array",
        items: { type: "string" },
        description: "Ordered actions to apply",
      },
      summary: { type: "string" },
      optimizedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "suggestions_only", description: "Output is suggestions only; no content or system mutation.", enforce: "hard" },
    { code: "plain_text_only", description: "Variants are plain text; no HTML.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(autoImproveCTAsCapability);

export type CTAInput = {
  id?: string | null;
  label: string;
  context?: string | null;
  positionInPage?: number | null;
};

export type AutoImproveCTAsInput = {
  ctas: CTAInput[];
  conversionGoal?: string | null;
  locale?: "nb" | "en" | null;
  maxVariantsPerCta?: number | null;
};

export type CTAVariantSuggestion = {
  buttonLabel: string;
  title: string;
};

export type CTAImprovement = {
  ctaRef: string;
  priority: "high" | "medium" | "low";
  currentLabel: string;
  suggestedVariants: CTAVariantSuggestion[];
  rationale: string;
  placementHint?: string | null;
};

export type AutoImproveCTAsOutput = {
  improvements: CTAImprovement[];
  actionPlan: string[];
  summary: string;
  optimizedAt: string;
};

const GENERIC_PATTERNS = [
  "klikk her",
  "click here",
  "submit",
  "send",
  "les mer",
  "read more",
  "klikk",
  "send inn",
  "submit form",
];

function isGeneric(text: string): boolean {
  const t = text.toLowerCase().trim();
  return GENERIC_PATTERNS.some((p) => t === p || t.includes(p));
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const VARIANTS_NB: CTAVariantSuggestion[] = [
  { buttonLabel: "Be om demo", title: "Få en kort gjennomgang av løsningen." },
  { buttonLabel: "Kontakt oss", title: "Vi svarer på spørsmål og sender informasjon." },
  { buttonLabel: "Få tilbud", title: "Vi tilpasser et tilbud til deres behov." },
];

const VARIANTS_EN: CTAVariantSuggestion[] = [
  { buttonLabel: "Request demo", title: "Get a short walkthrough of the solution." },
  { buttonLabel: "Contact us", title: "We answer questions and send information." },
  { buttonLabel: "Get a quote", title: "We tailor an offer to your needs." },
];

/**
 * Autonomous CTA optimizer: prioritizes and suggests improvements for multiple CTAs.
 * Deterministic; no external calls.
 */
export function autoImproveCTAs(input: AutoImproveCTAsInput): AutoImproveCTAsOutput {
  const ctas = Array.isArray(input.ctas) ? input.ctas : [];
  const isEn = input.locale === "en";
  const maxVariants = Math.min(5, Math.max(1, Math.floor(Number(input.maxVariantsPerCta) ?? 3)));
  const base = isEn ? VARIANTS_EN : VARIANTS_NB;

  const improvements: CTAImprovement[] = [];
  const actionPlan: string[] = [];

  for (let i = 0; i < ctas.length; i++) {
    const cta = ctas[i];
    const label = safeStr(cta?.label);
    const ctaRef = safeStr(cta?.id) || (label ? `cta_${i + 1}` : `cta_${i + 1}_empty`);
    const context = safeStr(cta?.context).toLowerCase();

    if (!label) {
      improvements.push({
        ctaRef,
        priority: "high",
        currentLabel: "",
        suggestedVariants: base.slice(0, maxVariants),
        rationale: isEn ? "Missing CTA label; add an action-oriented label." : "Mangler CTA-etiketten; legg til en handlingsorientert etikett.",
        placementHint: context === "hero" ? (isEn ? "Hero: use primary conversion CTA." : "Hero: bruk primær konverterings-CTA.") : undefined,
      });
      continue;
    }

    const generic = isGeneric(label);
    const longLabel = label.length > 25;
    const priority: "high" | "medium" | "low" = generic ? "high" : longLabel ? "medium" : "low";

    const suggestedVariants: CTAVariantSuggestion[] = [];
    if (!generic) {
      suggestedVariants.push({
        buttonLabel: label,
        title: isEn ? "Keep current; consider adding a short headline above." : "Behold nåværende; vurder kort overskrift over.",
      });
    }
    for (const v of base) {
      if (suggestedVariants.length >= maxVariants) break;
      if (suggestedVariants.some((x) => x.buttonLabel === v.buttonLabel)) continue;
      suggestedVariants.push(v);
    }

    let rationale: string;
    if (generic) {
      rationale = isEn
        ? `"${label}" is generic; action-specific CTAs typically convert better.`
        : `«${label}» er generisk; handlingsspesifikke CTA-er konverterer vanligvis bedre.`;
    } else if (longLabel) {
      rationale = isEn
        ? `Shorter CTA (1–3 words) often performs better; consider condensing.`
        : `Kortere CTA (1–3 ord) presterer ofte bedre; vurder å forkorte.`;
    } else {
      rationale = isEn
        ? `Optional improvement; test variants for lift.`
        : `Valgfri forbedring; test varianter for løft.`;
    }

    let placementHint: string | undefined;
    if (context === "hero") {
      placementHint = isEn ? "Hero: one primary CTA; keep label clear and action-focused." : "Hero: én primær CTA; behold etikett tydelig og handlingsorientert.";
    } else if (context === "footer") {
      placementHint = isEn ? "Footer: secondary CTA is fine; can repeat primary or use 'Contact'." : "Footer: sekundær CTA er greit; kan gjenta primær eller bruke «Kontakt».";
    }

    improvements.push({
      ctaRef,
      priority,
      currentLabel: label,
      suggestedVariants,
      rationale,
      placementHint: placementHint ?? undefined,
    });
  }

  improvements.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  for (const imp of improvements) {
    if (imp.priority === "high") {
      actionPlan.push(isEn ? `Replace or improve CTA "${imp.currentLabel || imp.ctaRef}" (high priority).` : `Erstatt eller forbedre CTA «${imp.currentLabel || imp.ctaRef}» (høy prioritet).`);
    } else if (imp.priority === "medium") {
      actionPlan.push(isEn ? `Consider shortening or testing CTA "${imp.currentLabel}".` : `Vurder å forkorte eller teste CTA «${imp.currentLabel}».`);
    }
  }
  if (actionPlan.length === 0 && improvements.length > 0) {
    actionPlan.push(isEn ? "All CTAs are in good shape; optional A/B test on variants." : "Alle CTA-er er i orden; valgfri A/B-test på varianter.");
  }

  const highCount = improvements.filter((i) => i.priority === "high").length;
  const summary = isEn
    ? `Analyzed ${ctas.length} CTA(s). ${highCount} high-priority improvement(s). ${actionPlan.length} action(s) in plan.`
    : `Analysert ${ctas.length} CTA(er). ${highCount} forbedring(er) med høy prioritet. ${actionPlan.length} handling(er) i planen.`;

  return {
    improvements,
    actionPlan,
    summary,
    optimizedAt: new Date().toISOString(),
  };
}

export { autoImproveCTAsCapability, CAPABILITY_NAME };

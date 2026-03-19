/**
 * AI PAGE INTENT ENGINE
 * AI analyserer hva en side faktisk prøver å oppnå: informere, selge, rekruttere, bygge tillit.
 * Basert på dette kan AI automatisk foreslå: riktig struktur, riktige seksjoner, riktige CTA.
 */

import { detectPageIntent } from "@/lib/ai/capabilities/detectPageIntent";
import type {
  DetectPageIntentInput,
  DetectPageIntentOutput,
  DetectPageIntentPageInput,
  PageIntentType,
} from "@/lib/ai/capabilities/detectPageIntent";
import { improvePageStructure } from "@/lib/ai/capabilities/improvePageStructure";
import type {
  ImprovePageStructureInput,
  ImprovePageStructureOutput,
  PageStructureImprovement,
} from "@/lib/ai/capabilities/improvePageStructure";
import { suggestSectionComposition } from "@/lib/ai/capabilities/suggestSectionComposition";
import type {
  SuggestSectionCompositionInput,
  SuggestSectionCompositionOutput,
  SectionSuggestion,
} from "@/lib/ai/capabilities/suggestSectionComposition";
import { autoImproveCTAs } from "@/lib/ai/capabilities/autoImproveCTAs";
import type {
  AutoImproveCTAsInput,
  AutoImproveCTAsOutput,
  CTAInput,
} from "@/lib/ai/capabilities/autoImproveCTAs";

export type { PageIntentType, PageStructureImprovement, SectionSuggestion, CTAInput };

/** Map page intent til pagePurpose for struktur og seksjoner. */
function intentToPagePurpose(intent: PageIntentType): string {
  switch (intent) {
    case "inform":
      return "info";
    case "sell":
      return "marketing";
    case "recruit":
      return "landing";
    case "trust":
      return "landing";
    default:
      return "landing";
  }
}

/** Analyserer hva siden prøver å oppnå: informere, selge, rekruttere, bygge tillit. */
export function analyzePageIntent(input: DetectPageIntentInput): DetectPageIntentOutput {
  return detectPageIntent(input);
}

/** Foreslår riktig struktur basert på side og intent (score, forbedringer, anbefalt rekkefølge). */
export function suggestStructure(
  page: ImprovePageStructureInput["page"],
  intent: PageIntentType,
  opts?: { locale?: "nb" | "en" | null }
): ImprovePageStructureOutput {
  const pagePurpose = intentToPagePurpose(intent);
  return improvePageStructure({
    page,
    pagePurpose,
    locale: opts?.locale,
  });
}

/** Foreslår riktige seksjoner basert på intent (hero, features, social proof, CTA, FAQ). */
export function suggestSections(
  intent: PageIntentType,
  opts?: { locale?: "nb" | "en" | null }
): SuggestSectionCompositionOutput {
  const pagePurpose = intentToPagePurpose(intent);
  return suggestSectionComposition({
    pagePurpose,
    locale: opts?.locale,
  });
}

/** Foreslår riktige CTA: enten fra eksisterende CTAs (forbedring) eller intent-basert anbefaling. */
export function suggestCta(
  intent: PageIntentType,
  ctas?: CTAInput[] | null,
  opts?: { conversionGoal?: string | null; locale?: "nb" | "en" | null }
): AutoImproveCTAsOutput | { recommendedCta: { label: string; context: string }; summary: string } {
  const locale = opts?.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";

  if (Array.isArray(ctas) && ctas.length > 0) {
    return autoImproveCTAs({
      ctas,
      conversionGoal: opts?.conversionGoal ?? undefined,
      locale,
    });
  }

  const byIntent: Record<PageIntentType, { label: string; context: string }> = {
    inform: isEn
      ? { label: "Learn more", context: "hero" }
      : { label: "Les mer", context: "hero" },
    sell: isEn
      ? { label: "Contact us", context: "hero" }
      : { label: "Kontakt oss", context: "hero" },
    recruit: isEn
      ? { label: "View openings", context: "hero" }
      : { label: "Se ledige stillinger", context: "hero" },
    trust: isEn
      ? { label: "Get in touch", context: "hero" }
      : { label: "Ta kontakt", context: "hero" },
  };

  const rec = byIntent[intent];
  return {
    recommendedCta: rec,
    summary: isEn
      ? `Recommended primary CTA for ${intent} intent: "${rec.label}". Add to hero or above fold.`
      : `Anbefalt primær CTA for ${intent}-intensjon: «${rec.label}». Legg til i hero eller over fold.`,
  };
}

/** Type for dispatch. */
export type PageIntentEngineKind = "analyze_intent" | "suggest_structure" | "suggest_sections" | "suggest_cta";

export type PageIntentEngineInput =
  | { kind: "analyze_intent"; input: DetectPageIntentInput }
  | {
      kind: "suggest_structure";
      page: DetectPageIntentPageInput | ImprovePageStructureInput["page"];
      intent: PageIntentType;
      locale?: "nb" | "en" | null;
    }
  | { kind: "suggest_sections"; intent: PageIntentType; locale?: "nb" | "en" | null }
  | {
      kind: "suggest_cta";
      intent: PageIntentType;
      ctas?: CTAInput[] | null;
      conversionGoal?: string | null;
      locale?: "nb" | "en" | null;
    };

export type PageIntentEngineResult =
  | { kind: "analyze_intent"; data: DetectPageIntentOutput }
  | { kind: "suggest_structure"; data: ImprovePageStructureOutput }
  | { kind: "suggest_sections"; data: SuggestSectionCompositionOutput }
  | {
      kind: "suggest_cta";
      data: AutoImproveCTAsOutput | { recommendedCta: { label: string; context: string }; summary: string };
    };

/**
 * Samlet dispatch: analyser intent, foreslå struktur, seksjoner eller CTA.
 */
export function runPageIntentEngine(req: PageIntentEngineInput): PageIntentEngineResult {
  switch (req.kind) {
    case "analyze_intent":
      return { kind: "analyze_intent", data: analyzePageIntent(req.input) };
    case "suggest_structure":
      return {
        kind: "suggest_structure",
        data: suggestStructure(req.page as ImprovePageStructureInput["page"], req.intent, {
          locale: req.locale,
        }),
      };
    case "suggest_sections":
      return { kind: "suggest_sections", data: suggestSections(req.intent, { locale: req.locale }) };
    case "suggest_cta":
      return {
        kind: "suggest_cta",
        data: suggestCta(req.intent, req.ctas, {
          conversionGoal: req.conversionGoal,
          locale: req.locale,
        }),
      };
    default:
      throw new Error(`Unknown page intent engine kind: ${(req as PageIntentEngineInput).kind}`);
  }
}

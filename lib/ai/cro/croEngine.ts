/**
 * AI CRO ENGINE
 * Optimaliserer: CTA, layout, tekst, seksjonsrekkefølge.
 * Samler forslag fra autoImproveCTAs, suggestScrollFlow, optimizeResponsiveLayout,
 * analyzeReadability, suggestSectionComposition. Kun forslag; ingen mutasjon.
 */

import { autoImproveCTAs } from "@/lib/ai/capabilities/autoImproveCTAs";
import type {
  AutoImproveCTAsInput,
  AutoImproveCTAsOutput,
  CTAInput,
} from "@/lib/ai/capabilities/autoImproveCTAs";
import { suggestScrollFlow } from "@/lib/ai/capabilities/suggestScrollFlow";
import type {
  SuggestScrollFlowInput,
  SuggestScrollFlowOutput,
  ScrollFlowSectionInput,
} from "@/lib/ai/capabilities/suggestScrollFlow";
import { optimizeResponsiveLayout } from "@/lib/ai/capabilities/optimizeResponsiveLayout";
import type {
  OptimizeResponsiveLayoutInput,
  OptimizeResponsiveLayoutOutput,
  LayoutInput,
} from "@/lib/ai/capabilities/optimizeResponsiveLayout";
import { analyzeReadability } from "@/lib/ai/capabilities/analyzeReadability";
import type {
  AnalyzeReadabilityInput,
  AnalyzeReadabilityOutput,
  ReadabilityContentInput,
} from "@/lib/ai/capabilities/analyzeReadability";
import { suggestSectionComposition } from "@/lib/ai/capabilities/suggestSectionComposition";
import type {
  SuggestSectionCompositionInput,
  SuggestSectionCompositionOutput,
} from "@/lib/ai/capabilities/suggestSectionComposition";

export type { CTAInput, ScrollFlowSectionInput, LayoutInput, ReadabilityContentInput };

/** Input til CRO-engine: alle felter valgfrie; kun de som er satt kjører respektive optimalisering. */
export type CroEngineInput = {
  /** CTAs på siden (label, context, position) → CTA-optimalisering. */
  ctas?: CTAInput[] | null;
  /** Seksjoner/blokker i nåværende rekkefølge → seksjonsrekkefølge + scroll flow. */
  sections?: ScrollFlowSectionInput[] | null;
  /** Nåværende layout (breakpoints, columns, sections) → layout-optimalisering. */
  layout?: LayoutInput | null;
  /** Tekstinnhold (plainText eller blocks) → lesbarhet og tekstforslag. */
  content?: ReadabilityContentInput | null;
  /** Sideformål (landing, product, marketing) → seksjonssammensetning. */
  pagePurpose?: string | null;
  locale?: "nb" | "en" | null;
  conversionGoal?: string | null;
};

/** Resultat per område (kun med når input var gitt). */
export type CroEngineOutput = {
  /** CTA-forbedringer og handlingsplan. */
  cta?: AutoImproveCTAsOutput | null;
  /** Layout-forslag (responsive, breakpoints, touch targets). */
  layout?: OptimizeResponsiveLayoutOutput | null;
  /** Tekst/lesbarhet: score, metrikker, forslag. */
  text?: AnalyzeReadabilityOutput | null;
  /** Seksjonsrekkefølge og scroll-flow-forslag. */
  sectionOrder?: SuggestScrollFlowOutput | null;
  /** Anbefalt seksjonssammensetning (hero, features, CTA, FAQ). */
  sectionComposition?: SuggestSectionCompositionOutput | null;
  /** Kort oppsummering av alle kjøringer. */
  summary: string;
  /** ISO-tidsstempel. */
  optimizedAt: string;
};

/**
 * Kjører CRO-engine: optimaliserer CTA, layout, tekst og seksjonsrekkefølge
 * basert på hva som er sendt inn. Returnerer kun forslag; ingen endring av data.
 */
export function runCroEngine(input: CroEngineInput): CroEngineOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const parts: string[] = [];
  const optimizedAt = new Date().toISOString();

  let cta: AutoImproveCTAsOutput | null = null;
  let layoutOut: OptimizeResponsiveLayoutOutput | null = null;
  let text: AnalyzeReadabilityOutput | null = null;
  let sectionOrder: SuggestScrollFlowOutput | null = null;
  let sectionComposition: SuggestSectionCompositionOutput | null = null;

  if (Array.isArray(input.ctas) && input.ctas.length > 0) {
    const ctaInput: AutoImproveCTAsInput = {
      ctas: input.ctas,
      conversionGoal: input.conversionGoal ?? undefined,
      locale,
    };
    cta = autoImproveCTAs(ctaInput);
    parts.push(isEn ? `CTA: ${cta.improvements.length} improvement(s).` : `CTA: ${cta.improvements.length} forbedring(er).`);
  }

  if (Array.isArray(input.sections) && input.sections.length > 0) {
    const flowInput: SuggestScrollFlowInput = {
      sections: input.sections,
      locale,
    };
    sectionOrder = suggestScrollFlow(flowInput);
    parts.push(
      isEn
        ? `Section order: ${sectionOrder.suggestions.length} suggestion(s), suggested order length ${sectionOrder.suggestedOrder.length}.`
        : `Seksjonsrekkefølge: ${sectionOrder.suggestions.length} forslag, anbefalt rekkefølge lengde ${sectionOrder.suggestedOrder.length}.`
    );
  }

  if (input.layout && typeof input.layout === "object") {
    const layoutInput: OptimizeResponsiveLayoutInput = {
      layout: input.layout,
      locale,
    };
    layoutOut = optimizeResponsiveLayout(layoutInput);
    parts.push(
      isEn
        ? `Layout: ${layoutOut.optimizations.length} optimization(s).`
        : `Layout: ${layoutOut.optimizations.length} optimalisering(er).`
    );
  }

  if (input.content && (input.content.plainText || (Array.isArray(input.content.blocks) && input.content.blocks.length > 0))) {
    const readInput: AnalyzeReadabilityInput = {
      content: input.content,
      locale,
    };
    text = analyzeReadability(readInput);
    parts.push(isEn ? `Text: readability score ${text.score}, ${text.suggestions.length} suggestion(s).` : `Tekst: lesbarhet ${text.score}, ${text.suggestions.length} forslag.`);
  }

  const purpose = typeof input.pagePurpose === "string" ? input.pagePurpose.trim() : "";
  if (purpose) {
    const compInput: SuggestSectionCompositionInput = {
      pagePurpose: purpose,
      locale,
    };
    sectionComposition = suggestSectionComposition(compInput);
    parts.push(
      isEn
        ? `Section composition: ${sectionComposition.sections.length} section(s) suggested.`
        : `Seksjonssammensetning: ${sectionComposition.sections.length} seksjon(er) foreslått.`
    );
  }

  const summary =
    parts.length > 0
      ? parts.join(" ")
      : isEn
        ? "No CRO input provided; pass ctas, sections, layout, content, or pagePurpose."
        : "Ingen CRO-input gitt; send inn ctas, sections, layout, content eller pagePurpose.";

  return {
    ...(cta !== null && { cta }),
    ...(layoutOut !== null && { layout: layoutOut }),
    ...(text !== null && { text }),
    ...(sectionOrder !== null && { sectionOrder }),
    ...(sectionComposition !== null && { sectionComposition }),
    summary,
    optimizedAt,
  };
}

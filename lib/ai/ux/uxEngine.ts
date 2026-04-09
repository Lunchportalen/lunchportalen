// STATUS: KEEP

/**
 * AI UX ENGINE
 * Analyserer: scroll, friksjon, navigasjon, kognitiv belastning.
 * Samler analyser fra suggestScrollFlow, suggestUXFixes, analyzeLayoutReadability,
 * analyzeInterfaceReadability (og valgfritt analyzeReadability). Kun analyse; ingen mutasjon.
 */

import { suggestScrollFlow } from "@/lib/ai/engines/capabilities/suggestScrollFlow";
import type {
  SuggestScrollFlowInput,
  SuggestScrollFlowOutput,
  ScrollFlowSectionInput,
} from "@/lib/ai/engines/capabilities/suggestScrollFlow";
import { suggestUXFixes } from "@/lib/ai/engines/capabilities/suggestUXFixes";
import type {
  SuggestUXFixesInput,
  SuggestUXFixesOutput,
  UXFix,
  UXFixCategory,
} from "@/lib/ai/engines/capabilities/suggestUXFixes";
import { analyzeLayoutReadability } from "@/lib/ai/engines/capabilities/analyzeLayoutReadability";
import type {
  LayoutReadabilityInput,
  AnalyzeLayoutReadabilityOutput,
} from "@/lib/ai/engines/capabilities/analyzeLayoutReadability";
import { analyzeInterfaceReadability } from "@/lib/ai/engines/capabilities/analyzeInterfaceReadability";
import type {
  AnalyzeInterfaceReadabilityInput,
  AnalyzeInterfaceReadabilityOutput,
  ReadabilityTextBlock,
} from "@/lib/ai/engines/capabilities/analyzeInterfaceReadability";
import { analyzeReadability } from "@/lib/ai/engines/capabilities/analyzeReadability";
import type {
  AnalyzeReadabilityInput,
  AnalyzeReadabilityOutput,
  ReadabilityContentInput,
} from "@/lib/ai/engines/capabilities/analyzeReadability";

export type { ScrollFlowSectionInput, UXFix, UXFixCategory, ReadabilityTextBlock, ReadabilityContentInput };

/** Kategorier som teller som friksjon (form, flow, cta). */
const FRICTION_CATEGORIES: UXFixCategory[] = ["form", "flow", "cta"];

/** Input til UX-engine: alle felter valgfrie; kun det som er satt kjører respektive analyse. */
export type UxEngineInput = {
  /** Seksjoner i nåværende rekkefølge → scroll-analyse. */
  sections?: ScrollFlowSectionInput[] | null;
  /** Layout (sections, placements, columns, gap) → layout-lesbarhet (kognitiv). */
  layout?: LayoutReadabilityInput["layout"] | null;
  /** Tekstblokker (heading, paragraph, label) → grensesnitt-lesbarhet (kognitiv). */
  textBlocks?: ReadabilityTextBlock[] | null;
  /** Brødtekst/innhold → innholdslesbarhet (kognitiv). */
  content?: ReadabilityContentInput | null;
  /** Layoutbeskrivelse og/eller blokker → UX-forslag (friksjon + navigasjon). */
  layoutDescription?: string | null;
  blocks?: Array<{ id?: string | null; type?: string | null }> | null;
  device?: "mobile" | "desktop" | "both" | null;
  locale?: "nb" | "en" | null;
  maxUxFixes?: number | null;
};

/** Scroll-analyse (fra suggestScrollFlow). */
export type ScrollAnalysis = SuggestScrollFlowOutput;

/** Friksjonsanalyse: UX-forslag som indikerer friksjon (form, flow, cta). */
export type FrictionAnalysis = {
  fixes: UXFix[];
  summary: string;
};

/** Navigasjonsanalyse: UX-forslag knyttet til navigasjon. */
export type NavigationAnalysis = {
  fixes: UXFix[];
  summary: string;
};

/** Kognitiv belastning: samlet lesbarhet fra layout, grensesnitt og valgfritt innhold. */
export type CognitiveLoadAnalysis = {
  /** Layout-scannability 0–100 (høyere = bedre). */
  layoutScore?: number;
  /** Grensesnitt-lesbarhet 0–100. */
  interfaceScore?: number;
  /** Innholdslesbarhet 0–100 (når content er gitt). */
  contentScore?: number;
  /** Vektet gjennomsnitt når flere scores finnes. */
  combinedScore: number;
  issues: string[];
  suggestions: string[];
  summary: string;
};

/** Resultat per område (kun med når input var gitt). */
export type UxEngineOutput = {
  /** Scroll-flyt og seksjonsrekkefølge. */
  scroll?: ScrollAnalysis | null;
  /** Friksjon: form, flow, CTA-forslag. */
  friction?: FrictionAnalysis | null;
  /** Navigasjon: navigasjonsrelaterte forslag. */
  navigation?: NavigationAnalysis | null;
  /** Kognitiv belastning: lesbarhet og scannability. */
  cognitiveLoad?: CognitiveLoadAnalysis | null;
  /** Kort oppsummering av alle analyser. */
  summary: string;
  /** ISO-tidsstempel. */
  analyzedAt: string;
};

function runScrollAnalysis(
  sections: ScrollFlowSectionInput[],
  locale: "nb" | "en"
): SuggestScrollFlowOutput {
  return suggestScrollFlow({ sections, locale });
}

function runUxFixes(input: SuggestUXFixesInput): SuggestUXFixesOutput {
  return suggestUXFixes(input);
}

function runLayoutReadability(layout: LayoutReadabilityInput["layout"], locale: "nb" | "en"): AnalyzeLayoutReadabilityOutput {
  return analyzeLayoutReadability({ layout, locale });
}

function runInterfaceReadability(
  textBlocks: ReadabilityTextBlock[],
  locale: "nb" | "en"
): AnalyzeInterfaceReadabilityOutput {
  return analyzeInterfaceReadability({ textBlocks, locale });
}

function runContentReadability(content: ReadabilityContentInput, locale: "nb" | "en"): AnalyzeReadabilityOutput {
  return analyzeReadability({ content, locale });
}

/**
 * Kjører UX-engine: analyserer scroll, friksjon, navigasjon og kognitiv belastning
 * basert på hva som sendes inn. Returnerer kun analyse; ingen endring av data.
 */
export function runUxEngine(input: UxEngineInput): UxEngineOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const parts: string[] = [];
  const analyzedAt = new Date().toISOString();

  let scroll: SuggestScrollFlowOutput | null = null;
  let friction: FrictionAnalysis | null = null;
  let navigation: NavigationAnalysis | null = null;
  let cognitiveLoad: CognitiveLoadAnalysis | null = null;

  if (Array.isArray(input.sections) && input.sections.length > 0) {
    scroll = runScrollAnalysis(input.sections, locale);
    parts.push(
      isEn
        ? `Scroll: ${scroll.suggestions.length} suggestion(s), order length ${scroll.suggestedOrder.length}.`
        : `Scroll: ${scroll.suggestions.length} forslag, rekkefølgelengde ${scroll.suggestedOrder.length}.`
    );
  }

  const hasUxInput =
    (typeof input.layoutDescription === "string" && input.layoutDescription.length > 0) ||
    (Array.isArray(input.blocks) && input.blocks.length > 0);
  if (hasUxInput) {
    const uxOut = runUxFixes({
      layoutDescription: input.layoutDescription ?? undefined,
      blocks: input.blocks ?? undefined,
      device: input.device ?? undefined,
      locale,
      maxFixes: input.maxUxFixes ?? 20,
    });
    const frictionFixes = uxOut.fixes.filter((f) => FRICTION_CATEGORIES.includes(f.category));
    const navFixes = uxOut.fixes.filter((f) => f.category === "navigation");
    if (frictionFixes.length > 0) {
      friction = {
        fixes: frictionFixes,
        summary:
          isEn
            ? `${frictionFixes.length} friction-related suggestion(s) (form, flow, CTA).`
            : `${frictionFixes.length} friksjonsrelaterte forslag (skjema, flyt, CTA).`,
      };
      parts.push(isEn ? `Friction: ${frictionFixes.length} fix(es).` : `Friksjon: ${frictionFixes.length} forslag.`);
    }
    if (navFixes.length > 0) {
      navigation = {
        fixes: navFixes,
        summary:
          isEn
            ? `${navFixes.length} navigation-related suggestion(s).`
            : `${navFixes.length} navigasjonsrelaterte forslag.`,
      };
      parts.push(isEn ? `Navigation: ${navFixes.length} fix(es).` : `Navigasjon: ${navFixes.length} forslag.`);
    }
  }

  const hasLayout =
    input.layout &&
    typeof input.layout === "object" &&
    (Array.isArray((input.layout as LayoutReadabilityInput["layout"]).sections) ||
      (input.layout as LayoutReadabilityInput["layout"]).sections === undefined);
  const hasTextBlocks = Array.isArray(input.textBlocks) && input.textBlocks.length > 0;
  const hasContent =
    input.content &&
    ((typeof input.content.plainText === "string" && input.content.plainText.length > 0) ||
      (Array.isArray(input.content.blocks) && input.content.blocks.length > 0));

  if (hasLayout || hasTextBlocks || hasContent) {
    const issues: string[] = [];
    const suggestions: string[] = [];
    let layoutScore: number | undefined;
    let interfaceScore: number | undefined;
    let contentScore: number | undefined;

    if (hasLayout) {
      const layoutOut = runLayoutReadability(input.layout as LayoutReadabilityInput["layout"], locale);
      layoutScore = layoutOut.score;
      issues.push(...layoutOut.issues);
      suggestions.push(...layoutOut.suggestions);
    }
    if (hasTextBlocks) {
      const ifaceOut = runInterfaceReadability(input.textBlocks!, locale);
      interfaceScore = ifaceOut.readabilityScore;
      issues.push(...ifaceOut.issues.map((i) => i.message));
      suggestions.push(...ifaceOut.suggestions);
    }
    if (hasContent) {
      const contentOut = runContentReadability(input.content!, locale);
      contentScore = contentOut.score;
      issues.push(...contentOut.suggestions.slice(0, 5));
      suggestions.push(...contentOut.suggestions.slice(0, 5));
    }

    const scores = [layoutScore, interfaceScore, contentScore].filter(
      (s): s is number => typeof s === "number" && !Number.isNaN(s)
    );
    const combinedScore =
      scores.length > 0
        ? Math.round(
            scores.reduce((a, b) => a + b, 0) / scores.length
          )
        : 0;

    cognitiveLoad = {
      ...(layoutScore !== undefined && { layoutScore }),
      ...(interfaceScore !== undefined && { interfaceScore }),
      ...(contentScore !== undefined && { contentScore }),
      combinedScore,
      issues: [...new Set(issues)].slice(0, 15),
      suggestions: [...new Set(suggestions)].slice(0, 15),
      summary:
        isEn
          ? `Cognitive load: combined readability ${combinedScore}/100 (layout ${layoutScore ?? "—"}, interface ${interfaceScore ?? "—"}, content ${contentScore ?? "—"}).`
          : `Kognitiv belastning: kombinert lesbarhet ${combinedScore}/100 (layout ${layoutScore ?? "—"}, grensesnitt ${interfaceScore ?? "—"}, innhold ${contentScore ?? "—"}).`,
    };
    parts.push(
      isEn ? `Cognitive load: combined score ${cognitiveLoad.combinedScore}.` : `Kognitiv belastning: kombinert score ${cognitiveLoad.combinedScore}.`
    );
  }

  const summary =
    parts.length > 0
      ? parts.join(" ")
      : isEn
        ? "No UX input provided; pass sections, layout, textBlocks, content, or layoutDescription/blocks."
        : "Ingen UX-input gitt; send inn sections, layout, textBlocks, content eller layoutDescription/blocks.";

  return {
    ...(scroll !== null && { scroll }),
    ...(friction !== null && { friction }),
    ...(navigation !== null && { navigation }),
    ...(cognitiveLoad !== null && { cognitiveLoad }),
    summary,
    analyzedAt,
  };
}

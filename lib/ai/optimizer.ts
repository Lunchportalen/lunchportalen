/**
 * AI SEO + CRO ENGINE — vekstmotoren.
 * SEO og konvertering er samme system.
 * Analyserer: struktur, søkeintensjon, CTA, friksjon, interne lenker.
 * Kun analyse og forslag; ingen mutasjon.
 */

import { improvePageStructure } from "@/lib/ai/capabilities/improvePageStructure";
import type {
  ImprovePageStructureInput,
  ImprovePageStructureOutput,
  PageStructureImprovement,
} from "@/lib/ai/capabilities/improvePageStructure";
import { classifySearchIntent } from "@/lib/ai/capabilities/classifySearchIntent";
import type {
  ClassifySearchIntentInput,
  ClassifySearchIntentOutput,
  SearchIntentType,
} from "@/lib/ai/capabilities/classifySearchIntent";
import { autoImproveCTAs } from "@/lib/ai/capabilities/autoImproveCTAs";
import type {
  AutoImproveCTAsInput,
  AutoImproveCTAsOutput,
  CTAInput,
} from "@/lib/ai/capabilities/autoImproveCTAs";
import { detectConversionFriction } from "@/lib/ai/capabilities/detectConversionFriction";
import type {
  DetectConversionFrictionInput,
  DetectConversionFrictionOutput,
  FrictionPoint,
} from "@/lib/ai/capabilities/detectConversionFriction";
import { generateInternalLinks } from "@/lib/ai/capabilities/generateInternalLinks";
import type {
  GenerateInternalLinksInput,
  GenerateInternalLinksOutput,
  PageContentInput,
  SiteGraphNode,
  SuggestedInternalLink,
} from "@/lib/ai/capabilities/generateInternalLinks";

export type {
  PageStructureImprovement,
  SearchIntentType,
  CTAInput,
  FrictionPoint,
  PageContentInput,
  SiteGraphNode,
  SuggestedInternalLink,
};

/** Analyserer sidestruktur: score, forbedringer, anbefalt blokk-rekkefølge. */
export function analyzeStructure(input: ImprovePageStructureInput): ImprovePageStructureOutput {
  return improvePageStructure(input);
}

/** Analyserer søkeintensjon: informasjonell, navigasjonell, transaksjonell, commercial_investigation. */
export function analyzeSearchIntent(input: ClassifySearchIntentInput): ClassifySearchIntentOutput {
  return classifySearchIntent(input);
}

/** Analyserer CTA: forbedringsforslag, varianter, handlingsplan. */
export function analyzeCta(input: AutoImproveCTAsInput): AutoImproveCTAsOutput {
  return autoImproveCTAs(input);
}

/** Analyserer konverteringsfriksjon: steg, skjema, tillit, CTA-klarhet. */
export function analyzeFriction(
  input: DetectConversionFrictionInput = {}
): DetectConversionFrictionOutput {
  return detectConversionFriction(input);
}

/** Analyserer interne lenker: forslag fra sideinnhold og site-graf. */
export function analyzeInternalLinks(input: GenerateInternalLinksInput): GenerateInternalLinksOutput {
  return generateInternalLinks(input);
}

/** Type for dispatch. */
export type OptimizerKind =
  | "structure"
  | "search_intent"
  | "cta"
  | "friction"
  | "internal_links";

export type OptimizerInput =
  | { kind: "structure"; input: ImprovePageStructureInput }
  | { kind: "search_intent"; input: ClassifySearchIntentInput }
  | { kind: "cta"; input: AutoImproveCTAsInput }
  | { kind: "friction"; input?: DetectConversionFrictionInput }
  | { kind: "internal_links"; input: GenerateInternalLinksInput };

export type OptimizerResult =
  | { kind: "structure"; data: ImprovePageStructureOutput }
  | { kind: "search_intent"; data: ClassifySearchIntentOutput }
  | { kind: "cta"; data: AutoImproveCTAsOutput }
  | { kind: "friction"; data: DetectConversionFrictionOutput }
  | { kind: "internal_links"; data: GenerateInternalLinksOutput };

/**
 * Samlet dispatch: struktur, søkeintensjon, CTA, friksjon, interne lenker.
 */
export function runOptimizer(req: OptimizerInput): OptimizerResult {
  switch (req.kind) {
    case "structure":
      return { kind: "structure", data: analyzeStructure(req.input) };
    case "search_intent":
      return { kind: "search_intent", data: analyzeSearchIntent(req.input) };
    case "cta":
      return { kind: "cta", data: analyzeCta(req.input) };
    case "friction":
      return { kind: "friction", data: analyzeFriction(req.input) };
    case "internal_links":
      return { kind: "internal_links", data: analyzeInternalLinks(req.input) };
    default:
      throw new Error(`Unknown optimizer kind: ${(req as OptimizerInput).kind}`);
  }
}

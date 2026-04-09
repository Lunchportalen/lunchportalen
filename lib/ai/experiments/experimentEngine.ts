// STATUS: KEEP

/**
 * AI EXPERIMENT ENGINE
 * Dette er der systemet begynner å bli autonomt.
 * Den gjør: A/B-tester, velger vinnere, implementerer forbedringer.
 * Tabeller: ai_experiments, ai_experiment_results (persistens via aiExperimentsRepo).
 *
 * Samler: suggestABTests, generateABTests, generateGrowthExperiments, scoreExperimentResults, detectWinningVariant.
 * For å lagre eksperiment og resultater: bruk lib/ai/experiments/aiExperimentsRepo (insertAiExperiment,
 * recordAiExperimentView/Click/Conversion, getAiExperimentStats, updateAiExperiment for winner_variant/status).
 */

import { suggestABTests } from "@/lib/ai/engines/capabilities/suggestABTests";
import type {
  SuggestABTestsInput,
  SuggestABTestsOutput,
  ABTestHypothesis,
} from "@/lib/ai/engines/capabilities/suggestABTests";
import { generateABTests } from "@/lib/ai/engines/capabilities/generateABTests";
import type {
  GenerateABTestsInput,
  GenerateABTestsOutput,
  GeneratedABTest,
} from "@/lib/ai/engines/capabilities/generateABTests";
import { generateGrowthExperiments } from "@/lib/ai/engines/capabilities/generateGrowthExperiments";
import type {
  GenerateGrowthExperimentsInput,
  GenerateGrowthExperimentsOutput,
  GrowthExperimentIdea,
} from "@/lib/ai/engines/capabilities/generateGrowthExperiments";
import { scoreExperimentResults } from "@/lib/ai/engines/capabilities/scoreExperimentResults";
import type {
  ScoreExperimentResultsInput,
  ScoreExperimentResultsOutput,
  VariantInput,
  VariantScore,
  Recommendation,
} from "@/lib/ai/engines/capabilities/scoreExperimentResults";
import { detectWinningVariant } from "@/lib/ai/engines/capabilities/detectWinningVariant";
import type {
  DetectWinningVariantInput,
  DetectWinningVariantOutput,
  WinningVariantEvidence,
} from "@/lib/ai/engines/capabilities/detectWinningVariant";

export type { ABTestHypothesis, GeneratedABTest, GrowthExperimentIdea, VariantInput, VariantScore, Recommendation, WinningVariantEvidence };

/** Foreslår konverteringshypoteser (A/B) fra sidekontekst (blokker). */
export function suggestConversionHypotheses(input: SuggestABTestsInput): SuggestABTestsOutput {
  return suggestABTests(input);
}

/** Starter A/B-tester: genererer klare test-spes (testId, element, control/variant, metric, varighet). */
export function startABTests(input: GenerateABTestsInput = {}): GenerateABTestsOutput {
  return generateABTests(input);
}

/** Genererer veksteksperiment-ideer for område og mål (hypotese, metrikk, variantidé, prioritet). */
export function generateExperimentIdeas(input: GenerateGrowthExperimentsInput): GenerateGrowthExperimentsOutput {
  return generateGrowthExperiments(input);
}

/** Analyserer eksperimentresultater: poeng per variant, anbefaling (winner/inconclusive), konfidens. */
export function analyzeExperimentResults(input: ScoreExperimentResultsInput): ScoreExperimentResultsOutput {
  return scoreExperimentResults(input);
}

/** Analyserer om det finnes en klar vinner: hasWinner, winningVariant, runnerUp, confidence, evidence. */
export function detectWinner(input: DetectWinningVariantInput): DetectWinningVariantOutput {
  return detectWinningVariant(input);
}

/** Type for dispatch. */
export type ExperimentEngineKind =
  | "hypotheses"
  | "start_ab_tests"
  | "growth_experiments"
  | "score_results"
  | "detect_winner";

export type ExperimentEngineInput =
  | { kind: "hypotheses"; input: SuggestABTestsInput }
  | { kind: "start_ab_tests"; input?: GenerateABTestsInput }
  | { kind: "growth_experiments"; input: GenerateGrowthExperimentsInput }
  | { kind: "score_results"; input: ScoreExperimentResultsInput }
  | { kind: "detect_winner"; input: DetectWinningVariantInput };

export type ExperimentEngineResult =
  | { kind: "hypotheses"; data: SuggestABTestsOutput }
  | { kind: "start_ab_tests"; data: GenerateABTestsOutput }
  | { kind: "growth_experiments"; data: GenerateGrowthExperimentsOutput }
  | { kind: "score_results"; data: ScoreExperimentResultsOutput }
  | { kind: "detect_winner"; data: DetectWinningVariantOutput };

/**
 * Samlet dispatch: konverteringshypoteser, start A/B-tester, veksteksperimenter, poeng resultater, oppdag vinner.
 */
export function runExperimentEngine(req: ExperimentEngineInput): ExperimentEngineResult {
  switch (req.kind) {
    case "hypotheses":
      return { kind: "hypotheses", data: suggestConversionHypotheses(req.input) };
    case "start_ab_tests":
      return { kind: "start_ab_tests", data: startABTests(req.input) };
    case "growth_experiments":
      return { kind: "growth_experiments", data: generateExperimentIdeas(req.input) };
    case "score_results":
      return { kind: "score_results", data: analyzeExperimentResults(req.input) };
    case "detect_winner":
      return { kind: "detect_winner", data: detectWinner(req.input) };
    default:
      throw new Error(`Unknown experiment engine kind: ${(req as ExperimentEngineInput).kind}`);
  }
}

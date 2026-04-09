// STATUS: KEEP

/**
 * Orchestrates design analysis + preview generation (on demand, no side effects).
 */

import { analyzeDesign, type DesignAnalysisResult } from "./designAnalyzer";
import { generateDesignFixes, type DesignGeneratorResult } from "./designGenerator";
import { getCmsDesignTokens } from "./designTokens";

export type DesignEngineResult = {
  score: number;
  issues: DesignAnalysisResult["issues"];
  suggestions: string[];
  improvements: DesignAnalysisResult["improvements"];
  updatedPreview: unknown[];
  generatorSuggestions: string[];
};

/**
 * Full pass: analyze structure, then build a preview block list with deterministic fixes.
 */
export function runDesignEngine(blocks: unknown[]): DesignEngineResult {
  const analysis = analyzeDesign(blocks);
  const tokens = getCmsDesignTokens();
  const gen: DesignGeneratorResult = generateDesignFixes(blocks, tokens);

  const suggestionTexts = [
    ...analysis.improvements.map((i) => i.message),
    ...analysis.issues.filter((x) => x.severity !== "info").map((x) => x.message),
    ...gen.suggestions,
  ];

  const unique = Array.from(new Set(suggestionTexts.map((s) => s.trim()).filter(Boolean)));

  return {
    score: analysis.score,
    issues: analysis.issues,
    suggestions: unique,
    improvements: analysis.improvements,
    updatedPreview: gen.updatedBlocks,
    generatorSuggestions: gen.suggestions,
  };
}

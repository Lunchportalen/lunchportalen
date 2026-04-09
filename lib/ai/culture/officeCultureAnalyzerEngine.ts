/**
 * AI OFFICE CULTURE ANALYZER ENGINE
 * AI analyserer preferanser i et selskap: vegetarandel, spicy vs mild, tradisjonell vs moderne mat.
 * Gir personaliserte menyer per firma.
 */

import { analyzeOfficeCulture } from "@/lib/ai/engines/capabilities/officeCultureAnalyzer";
import type {
  OfficeCultureAnalyzerInput,
  OfficeCultureProfile,
  DishChoiceWithTags,
} from "@/lib/ai/engines/capabilities/officeCultureAnalyzer";

export type { DishChoiceWithTags, OfficeCultureProfile };

/** Analyserer kontorpreferanser og returnerer profil for personaliserte menyer. */
export function getOfficeCultureProfile(
  input: OfficeCultureAnalyzerInput
): OfficeCultureProfile {
  return analyzeOfficeCulture(input);
}

export type OfficeCultureAnalyzerEngineKind = "analyze";

export type OfficeCultureAnalyzerEngineInput = {
  kind: "analyze";
  input: OfficeCultureAnalyzerInput;
};

export type OfficeCultureAnalyzerEngineResult = {
  kind: "analyze";
  data: OfficeCultureProfile;
};

/**
 * Kjører office culture analyzer: profil per firma for personaliserte menyer.
 */
export function runOfficeCultureAnalyzerEngine(
  req: OfficeCultureAnalyzerEngineInput
): OfficeCultureAnalyzerEngineResult {
  if (req.kind !== "analyze") {
    throw new Error(
      `Unknown office culture analyzer kind: ${(req as OfficeCultureAnalyzerEngineInput).kind}`
    );
  }
  return {
    kind: "analyze",
    data: getOfficeCultureProfile(req.input),
  };
}

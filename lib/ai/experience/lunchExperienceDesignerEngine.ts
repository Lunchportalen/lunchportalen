/**
 * AI LUNCH EXPERIENCE DESIGNER ENGINE
 * AI foreslår temamenyer og spesialdager for å øke trivsel.
 */

import { suggestLunchExperiences } from "@/lib/ai/engines/capabilities/lunchExperienceDesigner";
import type {
  LunchExperienceDesignerInput,
  LunchExperienceDesignerOutput,
  ThemeDaySuggestion,
  SeasonMenuSuggestion,
  InternationalWeekSuggestion,
  Season,
} from "@/lib/ai/engines/capabilities/lunchExperienceDesigner";

export type {
  Season,
  ThemeDaySuggestion,
  SeasonMenuSuggestion,
  InternationalWeekSuggestion,
};

/** Foreslår temadager, sesongmenyer og internasjonale uker for mer sosial lunsj. */
export function getLunchExperienceSuggestions(
  input: LunchExperienceDesignerInput
): LunchExperienceDesignerOutput {
  return suggestLunchExperiences(input);
}

export type LunchExperienceDesignerEngineKind = "suggest";

export type LunchExperienceDesignerEngineInput = {
  kind: "suggest";
  input: LunchExperienceDesignerInput;
};

export type LunchExperienceDesignerEngineResult = {
  kind: "suggest";
  data: LunchExperienceDesignerOutput;
};

/**
 * Kjører lunch experience designer: temamenyer og spesialdager for å øke trivsel.
 */
export function runLunchExperienceDesignerEngine(
  req: LunchExperienceDesignerEngineInput
): LunchExperienceDesignerEngineResult {
  if (req.kind !== "suggest") {
    throw new Error(
      `Unknown lunch experience designer kind: ${(req as LunchExperienceDesignerEngineInput).kind}`
    );
  }
  return {
    kind: "suggest",
    data: getLunchExperienceSuggestions(req.input),
  };
}

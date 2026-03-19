/**
 * AI OFFICE BEHAVIOUR MODEL
 * AI lærer hvordan hvert firma faktisk bruker systemet:
 * - hvilke dager folk spiser
 * - hvilke retter de velger
 * - hvor mange som avbestiller
 * Gir bedre prognoser og mindre matsvinn.
 */

import { buildOfficeBehaviourModel } from "@/lib/ai/capabilities/officeBehaviourModel";
import type {
  OfficeBehaviourModelInput,
  OfficeBehaviourModelOutput,
  UsageByDayEntry,
  DishChoiceEntry,
  DayPattern,
  DishPreferences,
  CancellationSummary,
} from "@/lib/ai/capabilities/officeBehaviourModel";

export type {
  UsageByDayEntry,
  DishChoiceEntry,
  DayPattern,
  DishPreferences,
  CancellationSummary,
};

/** Bygger kontoratferdsmodell fra bruk-per-dag og rettevalg. */
export function getOfficeBehaviourModel(
  input: OfficeBehaviourModelInput
): OfficeBehaviourModelOutput {
  return buildOfficeBehaviourModel(input);
}

export type OfficeBehaviourModelKind = "build_model";

export type OfficeBehaviourModelEngineInput = {
  kind: "build_model";
  input: OfficeBehaviourModelInput;
};

export type OfficeBehaviourModelEngineResult = {
  kind: "build_model";
  data: OfficeBehaviourModelOutput;
};

/**
 * Kjører office behaviour model: dagmønster, rettepreferanser, avbestillinger, prognose- og matsvinnhints.
 */
export function runOfficeBehaviourModel(
  req: OfficeBehaviourModelEngineInput
): OfficeBehaviourModelEngineResult {
  if (req.kind !== "build_model") {
    throw new Error(
      `Unknown office behaviour model kind: ${(req as OfficeBehaviourModelEngineInput).kind}`
    );
  }
  return {
    kind: "build_model",
    data: getOfficeBehaviourModel(req.input),
  };
}

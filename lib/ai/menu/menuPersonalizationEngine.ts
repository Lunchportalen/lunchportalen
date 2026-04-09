/**
 * AI MENU PERSONALIZATION ENGINE
 * Automatisk menytilpasning per firma basert på historikk.
 */

import { getPersonalizedMenuForCompany } from "@/lib/ai/engines/capabilities/menuPersonalization";
import type {
  MenuPersonalizationInput,
  MenuPersonalizationOutput,
  MenuPersonalizationDishInput,
  PersonalizedDishItem,
} from "@/lib/ai/engines/capabilities/menuPersonalization";

export type { MenuPersonalizationDishInput, PersonalizedDishItem };

/** Returnerer tilpasset meny for firma basert på bestillingshistorikk. */
export function getPersonalizedMenu(input: MenuPersonalizationInput): MenuPersonalizationOutput {
  return getPersonalizedMenuForCompany(input);
}

export type MenuPersonalizationEngineKind = "personalize";

export type MenuPersonalizationEngineInput = {
  kind: "personalize";
  input: MenuPersonalizationInput;
};

export type MenuPersonalizationEngineResult = {
  kind: "personalize";
  data: MenuPersonalizationOutput;
};

/**
 * Kjører menu personalization: menytilpasning per firma basert på historikk.
 */
export function runMenuPersonalizationEngine(
  req: MenuPersonalizationEngineInput
): MenuPersonalizationEngineResult {
  if (req.kind !== "personalize") {
    throw new Error(
      `Unknown menu personalization kind: ${(req as MenuPersonalizationEngineInput).kind}`
    );
  }
  return {
    kind: "personalize",
    data: getPersonalizedMenu(req.input),
  };
}

/**
 * AI DEMAND FORECAST ENGINE
 * Predikerer hvor mange lunsjer som trengs.
 * Data: historiske bestillinger, ukedag, ferie, vær, kontorstørrelse.
 * Resultat: produksjonsprognose.
 */

import { runDemandForecast } from "@/lib/ai/capabilities/demandForecast";
import type {
  DemandForecastInput,
  DemandForecastOutput,
  HistoricalOrderRow,
  LocalEventInput,
  DemandForecastDay,
  ProductionForecast,
} from "@/lib/ai/capabilities/demandForecast";

export type {
  HistoricalOrderRow,
  LocalEventInput,
  DemandForecastDay,
  ProductionForecast,
};

/** Estimerer fremtidig bestillingsvolum fra historikk, kalender, ferie, vær og hendelser. */
export function estimateDemand(input: DemandForecastInput): DemandForecastOutput {
  return runDemandForecast(input);
}

export type DemandForecastEngineKind = "forecast";

export type DemandForecastEngineInput = {
  kind: "forecast";
  input: DemandForecastInput;
};

export type DemandForecastEngineResult = {
  kind: "forecast";
  data: DemandForecastOutput;
};

/**
 * Kjører demand forecast engine: prognoser per dag for kjøkkenet.
 */
export function runDemandForecastEngine(
  req: DemandForecastEngineInput
): DemandForecastEngineResult {
  if (req.kind !== "forecast") {
    throw new Error(
      `Unknown demand forecast kind: ${(req as DemandForecastEngineInput).kind}`
    );
  }
  return {
    kind: "forecast",
    data: estimateDemand(req.input),
  };
}

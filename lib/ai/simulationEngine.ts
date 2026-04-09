/**
 * Digital twin / «hva hvis» — deterministiske scenarier uten sideeffekter.
 */

import type { GlobalIntelligenceContext } from "@/lib/ai/globalIntelligence";

export type SimulationScenario = "demand_spike" | "supplier_failure" | "delivery_delay";

/** Prediksjons-stub for beslutningsmotor (deterministisk, ingen nettverk). */
export type SimulatedAction<A> = {
  action: A;
  prediction: { predicted_conversion: number; confidence: number };
};

export async function simulateActions<A>(
  actions: A[],
  _ctx: GlobalIntelligenceContext,
): Promise<SimulatedAction<A>[]> {
  return actions.map((action, i) => ({
    action,
    prediction: { predicted_conversion: 0.5 - i * 0.01, confidence: 0.85 },
  }));
}

export type SimulationResult = {
  scenario: SimulationScenario;
  headline: string;
  deltas: Record<string, number>;
  explain: string[];
};

export function runWhatIfSimulation(
  scenario: SimulationScenario,
  baseline: { demand: number; capacity: number; leadTimeDays: number },
): SimulationResult {
  const d = Math.max(0, baseline.demand);
  const c = Math.max(1, baseline.capacity);
  const lt = Math.max(0, baseline.leadTimeDays);

  if (scenario === "demand_spike") {
    const newDemand = Math.round(d * 1.35);
    const ratio = newDemand / c;
    return {
      scenario,
      headline: "Etterspørsel +35 %: kapasitet og innkjøpsledetid er flaskehalser.",
      deltas: { demandDelta: newDemand - d, capacityGap: Math.max(0, newDemand - c), leadTimeDays: lt },
      explain: [
        `Ny etterspørsel (simulert): ${newDemand} mot kapasitet ${c}.`,
        ratio > 1 ? "Gap krever ekstra kjøkkenkapasitet eller omfordeling — kun forslag, ikke utført." : "Systemet holder innenfor kapasitet i simuleringen.",
      ],
    };
  }

  if (scenario === "supplier_failure") {
    return {
      scenario,
      headline: "Primærleverandør ute: bytt til reserve i leverandørnettverk (simulert).",
      deltas: { leadTimeDays: lt + 2, costPressureIndex: 12, availability: -1 },
      explain: [
        "Økt ledetid +2 d og midlertidig prispress i modellen.",
        "Bruk leverandørsammenligning og menneskelig godkjenning før reell bestilling.",
      ],
    };
  }

  return {
    scenario: "delivery_delay",
    headline: "Forsinket distribusjon: vinduer overskrides — kunderisiko og bufferbehov øker.",
    deltas: { onTimeProbability: -18, bufferNeedPercent: 8, leadTimeDays: lt + 1 },
    explain: [
      "Simulert +1 dag effektiv ledetid på rute.",
      "Vurder tidligere produksjonsstart eller alternativ rute (krever godkjenning).",
    ],
  };
}

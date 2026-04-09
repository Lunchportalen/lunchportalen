import type { PipelineDealCard } from "@/lib/pipeline/dealNormalize";
import { getNextAction } from "@/lib/pipeline/nextAction";
import { predictDeal, type PredictionResult } from "@/lib/pipeline/predict";

export type EnrichedPipelineDeal = PipelineDealCard & {
  prediction: PredictionResult;
  nextAction: string;
};

export function enrichPipelineDeal(deal: PipelineDealCard): EnrichedPipelineDeal {
  const prediction: EnrichedPipelineDeal["prediction"] = deal.predictionFromEngine
    ? {
        winProbability: deal.predictionFromEngine.winProbability,
        risk: deal.predictionFromEngine.risk,
        reasons: deal.predictionFromEngine.reasons,
      }
    : predictDeal(deal);

  return {
    ...deal,
    prediction,
    nextAction: getNextAction(deal),
  };
}

export function computePipelineInsights(deals: EnrichedPipelineDeal[]): {
  riskyDeals: number;
  strongDeals: number;
  avgWinProbability: number;
} {
  const list = Array.isArray(deals) ? deals : [];
  if (list.length === 0) {
    return { riskyDeals: 0, strongDeals: 0, avgWinProbability: 0 };
  }

  let riskyDeals = 0;
  let strongDeals = 0;
  let sumWin = 0;

  for (const d of list) {
    const p = d.prediction;
    if (p.risk === "high") riskyDeals += 1;
    if (p.risk === "low") strongDeals += 1;
    sumWin += p.winProbability;
  }

  return {
    riskyDeals,
    strongDeals,
    avgWinProbability: Math.round((sumWin / list.length) * 10) / 10,
  };
}

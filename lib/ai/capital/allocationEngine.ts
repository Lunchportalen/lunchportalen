import type { CapitalState } from "@/lib/ai/capital/capitalState";
import { INVESTMENT_AREAS, type InvestmentArea } from "@/lib/ai/capital/investmentAreas";
import { estimateROI } from "@/lib/ai/capital/roiEngine";
import { estimateRisk } from "@/lib/ai/capital/riskEngine";

export type CapitalAllocationRow = {
  area: InvestmentArea;
  roi: number;
  risk: number;
  score: number;
  allocation: number;
};

function fin(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Prioritizes areas by score = ROI − 0.5×risk; allocation % is proportional to max(score,0).
 * Advisory only — no capital movement.
 */
export function allocateCapital(state: CapitalState): CapitalAllocationRow[] {
  const allocations = INVESTMENT_AREAS.map((area) => {
    const roi = estimateROI(area, state);
    const risk = estimateRisk(area, state);
    const score = fin(roi - risk * 0.5);
    return { area, roi, risk, score, allocation: 0 };
  });

  const sorted = [...allocations].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.area.localeCompare(b.area);
  });

  const totalScore = sorted.reduce((sum, a) => sum + Math.max(a.score, 0), 0);

  return sorted.map((a) => ({
    ...a,
    allocation: totalScore > 0 ? fin(Math.max(a.score, 0) / totalScore) : 0,
  }));
}

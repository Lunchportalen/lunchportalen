import type { StrategyPillar } from "@/lib/ai/strategyEngine";

export type RoadmapStep = {
  week: number;
  action: "experiment" | "optimize" | "create_variant" | "pricing_review";
  focus: string;
};

export function buildRoadmap(strategy: StrategyPillar[]): RoadmapStep[] {
  const roadmap: RoadmapStep[] = [];
  for (const item of strategy) {
    switch (item) {
      case "RETENTION_FIRST":
        roadmap.push({ week: 1, action: "optimize", focus: "retention" });
        break;
      case "CONVERSION_OPTIMIZATION":
        roadmap.push({ week: 1, action: "experiment", focus: "funnel" });
        break;
      case "UNIT_ECONOMICS_FIX":
        roadmap.push({ week: 2, action: "pricing_review", focus: "ltv/cac" });
        break;
      case "ACQUISITION_PUSH":
        roadmap.push({ week: 3, action: "create_variant", focus: "landing_pages" });
        break;
      case "EXPERIMENTATION_BOOTSTRAP":
        roadmap.push({ week: 1, action: "experiment", focus: "baseline" });
        break;
      default:
        break;
    }
  }
  return roadmap;
}

import type { CategoryMode } from "@/lib/ai/monopoly/categoryEngine";

export type MonopolyStrategyPillar =
  | "CATEGORY_CREATION"
  | "CONTENT_EXPANSION"
  | "RETENTION_SYSTEM"
  | "SEO_DOMINATION"
  | "POSITIONING_REINFORCEMENT";

export function buildMonopolyStrategy(
  category: CategoryMode,
  demand: string[],
  lockIn: string[],
  effects: string[],
  threats: string[],
): MonopolyStrategyPillar[] {
  const strategy: MonopolyStrategyPillar[] = [];
  if (category === "CREATE_NEW_CATEGORY") {
    strategy.push("CATEGORY_CREATION");
  }
  if (demand.includes("INCREASE_CONTENT_OUTPUT")) {
    strategy.push("CONTENT_EXPANSION");
  }
  if (lockIn.includes("INCREASE_SWITCHING_COST")) {
    strategy.push("RETENTION_SYSTEM");
  }
  if (effects.includes("CONTENT_FLYWHEEL")) {
    strategy.push("SEO_DOMINATION");
  }
  if (threats.includes("HIGH_COMPETITION")) {
    strategy.push("POSITIONING_REINFORCEMENT");
  }
  return strategy;
}

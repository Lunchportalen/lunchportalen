import { generateVariant } from "@/lib/ai/generateVariant";
import type { BlockList } from "@/lib/cms/model/blockTypes";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";

export type AutonomousGeneratedAction =
  | { type: "variant"; data: BlockList }
  | { type: "optimize" }
  | { type: "experiment" }
  | null;

export function generateAutonomousAction(op: string): AutonomousGeneratedAction {
  switch (op) {
    case "CREATE_NEW_PAGES":
      return { type: "variant", data: generateVariant(buildMarketingHomeBody()) };
    case "OPTIMIZE_FUNNEL":
      return { type: "optimize" };
    case "START_EXPERIMENT":
      return { type: "experiment" };
    case "RETENTION_ACTION":
      return { type: "optimize" };
    case "IMPROVE_ONBOARDING":
      return { type: "optimize" };
    default:
      return null;
  }
}

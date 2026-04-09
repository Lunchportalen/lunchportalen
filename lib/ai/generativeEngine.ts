import { generateVariant } from "@/lib/ai/generateVariant";
import type { BlockList } from "@/lib/cms/model/blockTypes";
import { buildMarketingHomeBody } from "@/lib/cms/seed/marketingHomeBody";

export type SingularityGenerativeAction =
  | { type: "variant"; data: BlockList }
  | { type: "optimize" }
  | { type: "experiment" }
  | null;

/**
 * Maps a single opportunity tag to a concrete action shape. Unknown tags → null.
 */
export function generateAction(opportunity: string): SingularityGenerativeAction {
  switch (opportunity) {
    case "CREATE_VARIANT":
      return { type: "variant", data: generateVariant(buildMarketingHomeBody()) };
    case "OPTIMIZE_FUNNEL":
      return { type: "optimize" };
    case "START_EXPERIMENT":
      return { type: "experiment" };
    default:
      return null;
  }
}

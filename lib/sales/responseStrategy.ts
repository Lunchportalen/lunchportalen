/**
 * Strategi utledet kun fra innvendingstype (deterministisk).
 */
import type { ObjectionType } from "@/lib/sales/objections";

export type ResponseStrategy =
  | "positioning"
  | "value_reframe"
  | "reduce_friction"
  | "clarify"
  | "neutral";

export function getStrategy(type: ObjectionType): ResponseStrategy {
  switch (type) {
    case "existing_solution":
      return "positioning";
    case "price":
      return "value_reframe";
    case "timing":
      return "reduce_friction";
    case "uncertain":
      return "clarify";
    default:
      return "neutral";
  }
}

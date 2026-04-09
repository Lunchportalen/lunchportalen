import type { CtoOpportunity } from "./types";

/**
 * Sorterer etter forventet relativ effekt (høyest først). Muterer ikke input.
 */
export function prioritize(opportunities: CtoOpportunity[]): CtoOpportunity[] {
  return [...opportunities].sort((a, b) => b.expectedRevenueLift - a.expectedRevenueLift);
}

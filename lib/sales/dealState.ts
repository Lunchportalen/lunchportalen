export type DealStateSignal = {
  replied?: boolean;
  clicked?: boolean;
};

export type DealState = "engaged" | "interested" | "cold";

/**
 * Deterministic pipeline state from boolean signals (no ML).
 */
export function getDealState(input: DealStateSignal): DealState {
  if (input.replied === true) return "engaged";
  if (input.clicked === true) return "interested";
  return "cold";
}

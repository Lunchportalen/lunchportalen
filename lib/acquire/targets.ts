export type AcquireTarget = {
  name: string;
  size: "small" | "mid" | "large";
  value: number;
};

/**
 * Statisk illustrasjonsliste (ingen ekstern datakilde — ikke kjøp/ salg-råd).
 */
export function findTargets(): AcquireTarget[] {
  return [
    { name: "Competitor A", size: "mid", value: 5_000_000 },
    { name: "Competitor B", size: "small", value: 1_200_000 },
  ];
}

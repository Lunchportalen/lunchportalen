export type StabilityScore = "A" | "B" | "C" | "D";

export function stabilityScore(args: { ordered: number; wasteMeals: number }): StabilityScore | null {
  const o = args.ordered;
  if (!o || o <= 0) return null;

  const r = args.wasteMeals / o;

  if (r <= 0.02) return "A";
  if (r <= 0.05) return "B";
  if (r <= 0.10) return "C";
  return "D";
}

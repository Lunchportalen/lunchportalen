import { scoreVariant, type VariantScoreInput } from "@/lib/revenue/optimizer";

export type ScoredVariant<T extends VariantScoreInput> = T & { score: number };

export function selectBestVariant<T extends VariantScoreInput>(variants: T[]): ScoredVariant<T> | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  const scored = variants.map((v) => ({
    ...v,
    score: scoreVariant(v),
  })) as ScoredVariant<T>[];
  scored.sort((a, b) => b.score - a.score);
  return scored[0] ?? null;
}

import { MAX_COMBOS_PER_RUN } from "./safety";
import type { MvoVariant } from "./types";

/**
 * Begrenset variant-matrise (maks {MAX_COMBOS_PER_RUN} kombinasjoner) — ingen full kartesisk produkt.
 * `_base` er reservert for fremtidig kontekststyring uten å endre signatur.
 */
export function buildVariants(_base?: unknown): MvoVariant[] {
  const curated: MvoVariant[] = [
    { channel: "linkedin", segment: "small_company", timing: "morning" },
    { channel: "email", segment: "mid_company", timing: "afternoon" },
    { channel: "linkedin", segment: "enterprise", timing: "evening" },
  ];
  return curated.slice(0, MAX_COMBOS_PER_RUN);
}

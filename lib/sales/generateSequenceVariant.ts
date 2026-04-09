import "server-only";

import type { EditorTextRunContext } from "@/lib/ai/editorTextSuggest";
import type { HypothesisResult } from "@/lib/experiment/hypothesis";
import { improveSequence } from "@/lib/sales/improveSequence";
import { opsLog } from "@/lib/ops/log";

/**
 * Salgssekvens-variant: samme motor som `improveSequence`, beriket med hypotese (deterministisk).
 * Returnerer JSON-streng (som før) for lagring i `saveSequenceVariant`.
 */
export async function generateSequenceVariant(
  sequence: unknown,
  hypothesis: HypothesisResult,
  ctx: EditorTextRunContext
): Promise<string> {
  const wrapped = {
    hypothesis: { type: hypothesis.type, text: hypothesis.hypothesis },
    sequence,
  };
  opsLog("generate_sequence_variant", { hypothesisType: hypothesis.type });
  return improveSequence(wrapped, ctx);
}

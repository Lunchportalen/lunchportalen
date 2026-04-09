import "server-only";

import { generateVariant } from "@/lib/ai/generateVariant";
import { improveBlocks } from "@/lib/ai/autoImprove";
import type { BlockList } from "@/lib/cms/model/blockTypes";
import { parseBody } from "@/lib/cms/public/parseBody";

function toBlockList(body: unknown): BlockList {
  if (
    body &&
    typeof body === "object" &&
    (body as BlockList).version === 1 &&
    Array.isArray((body as BlockList).blocks)
  ) {
    return body as BlockList;
  }
  return { version: 1, blocks: parseBody(body) as BlockList["blocks"] };
}

/**
 * Deterministic A/B/C bodies for traffic experiments: control, AI variant, improved blocks.
 */
export function generateExperimentVariants(body: unknown): [unknown, unknown, unknown] {
  const variantA = body;
  const variantB = generateVariant(toBlockList(body));
  const variantC = improveBlocks(parseBody(body));
  return [variantA, variantB, variantC];
}

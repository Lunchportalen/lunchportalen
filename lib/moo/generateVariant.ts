import "server-only";

import type { AiLayoutRunContext } from "@/lib/ai/layout";
import { generatePage } from "@/lib/ai/pageBuilder";

/**
 * AI-only variant generation (same engine as POST /api/ai → {@link generatePage}).
 * Do not call from Edge; requires Node AI runtime and tenant context.
 */
export async function generateVariant(pageBlocks: unknown[], hint: string, ctx: AiLayoutRunContext): Promise<unknown[]> {
  const blocks = Array.isArray(pageBlocks) ? pageBlocks : [];
  const hintSafe = String(hint ?? "").trim();

  const prompt = `
Forbedre denne siden for:
- tydeligere verdi
- mindre friksjon
- bedre CTA
- bedre lesbarhet

Hint: ${hintSafe}

Eksisterende blokker (JSON, utdrag): ${JSON.stringify(blocks).slice(0, 12_000)}
`.trim();

  const out = await generatePage(prompt, ctx);
  const next = Array.isArray(out.blocks) && out.blocks.length > 0 ? out.blocks : blocks;
  return next as unknown[];
}

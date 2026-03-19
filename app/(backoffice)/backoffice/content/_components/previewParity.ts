/**
 * Preview vs published parity: compare current draft body with published (prod) body.
 * Used to show "Forhåndsvisningen avviker fra publisert" in the editor.
 * No duplicate render logic; comparison only.
 */

function extractBlocks(body: unknown): unknown[] {
  if (body == null) return [];
  if (Array.isArray(body)) return body;
  if (typeof body !== "object") return [];
  const b = body as Record<string, unknown>;
  if (Array.isArray(b.blocks)) return b.blocks;
  return [];
}

/** Stable stringify for comparison: sort block keys and strip undefined. */
function canonicalBlocks(blocks: unknown[]): string {
  try {
    const normalized = blocks.map((bl) => {
      if (bl == null || typeof bl !== "object") return bl;
      const o = bl as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(o).sort()) {
        const v = o[k];
        if (v !== undefined) out[k] = v;
      }
      return out;
    });
    return JSON.stringify(normalized);
  } catch {
    return "";
  }
}

/**
 * Returns true if the current draft body (serialized string from editor) differs
 * from the published body (prod variant, from API).
 */
export function previewDiffersFromPublished(
  currentBodySerialized: string,
  publishedBody: unknown
): boolean {
  let currentBlocks: unknown[] = [];
  try {
    const parsed = JSON.parse(currentBodySerialized);
    currentBlocks = extractBlocks(parsed);
  } catch {
    return true;
  }
  const publishedBlocks = extractBlocks(publishedBody);
  return canonicalBlocks(currentBlocks) !== canonicalBlocks(publishedBlocks);
}

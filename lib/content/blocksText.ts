/**
 * Deterministic helpers for first richText/text block body (CMS body jsonb).
 */

export type CmsBody = { version?: number; blocks?: unknown[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

/** Returns path info for first richText|text block with string body/text. */
export function findFirstTextBlockPath(body: unknown): { blockIndex: number; field: "body" | "text" } | null {
  if (!isPlainObject(body)) return null;
  const blocks = body.blocks;
  if (!Array.isArray(blocks)) return null;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!isPlainObject(b)) continue;
    const type = typeof b.type === "string" ? b.type : "";
    if (type !== "richText" && type !== "text") continue;
    const data = b.data;
    if (!isPlainObject(data)) continue;
    if (typeof data.body === "string" && data.body.trim()) return { blockIndex: i, field: "body" };
    if (typeof data.text === "string" && data.text.trim()) return { blockIndex: i, field: "text" };
  }
  return null;
}

export function extractFirstTextFromBody(body: unknown): string | null {
  const path = findFirstTextBlockPath(body);
  if (!path) return null;
  const blocks = (body as CmsBody).blocks;
  if (!Array.isArray(blocks)) return null;
  const b = blocks[path.blockIndex];
  if (!isPlainObject(b) || !isPlainObject(b.data)) return null;
  const raw = b.data[path.field];
  return typeof raw === "string" ? raw : null;
}

/** Immutable replace — returns new body object. */
export function replaceFirstTextInBody(body: unknown, newText: string): unknown {
  const path = findFirstTextBlockPath(body);
  if (!path) return body;
  if (!isPlainObject(body)) return body;
  const blocks = Array.isArray(body.blocks) ? [...body.blocks] : [];
  const block = blocks[path.blockIndex];
  if (!isPlainObject(block)) return body;
  const data = isPlainObject(block.data) ? { ...block.data } : {};
  data[path.field] = newText;
  const nextBlock = { ...block, data };
  blocks[path.blockIndex] = nextBlock;
  return { ...body, blocks };
}

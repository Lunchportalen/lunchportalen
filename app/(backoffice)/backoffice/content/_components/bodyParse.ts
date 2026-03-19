/**
 * Parse page body to BlockList (version + blocks as BlockNode[]).
 * Used by Editor2 and _stubs tryParseBlockListFromBody.
 * Fails explicitly when format is unsupported or blocks are invalid.
 */

import type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function toBlockNode(raw: unknown): BlockNode | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = safeStr(o.id);
  const type = safeStr(o.type);
  if (!id || !type) return null;
  const { id: _id, type: _type, ...rest } = o;
  return { id, type, data: rest && typeof rest === "object" && !Array.isArray(rest) ? (rest as Record<string, unknown>) : {} };
}

function extractBlocksSource(body: unknown): unknown[] | null {
  if (body == null) return null;
  if (typeof body === "object" && !Array.isArray(body)) {
    const obj = body as Record<string, unknown>;
    if (Array.isArray(obj.blocks)) return obj.blocks;
    if (obj.blocksBody !== undefined && obj.blocksBody !== null) {
      const blocksBody = obj.blocksBody;
      if (typeof blocksBody === "object" && !Array.isArray(blocksBody) && Array.isArray((blocksBody as Record<string, unknown>).blocks)) {
        return (blocksBody as Record<string, unknown>).blocks as unknown[];
      }
      if (typeof blocksBody === "string") {
        try {
          const parsed = JSON.parse(blocksBody) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray((parsed as Record<string, unknown>).blocks)) {
            return (parsed as Record<string, unknown>).blocks as unknown[];
          }
        } catch {
          return null;
        }
      }
    }
  }
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) return null;
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.blocks)) return obj.blocks;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function tryParseBlockListFromBody(body: unknown): { ok: true; list: BlockList } | { ok: false } {
  const source = extractBlocksSource(body);
  if (source === null) return { ok: false };
  const blocks: BlockNode[] = [];
  for (const item of source) {
    const node = toBlockNode(item);
    if (!node) return { ok: false };
    blocks.push(node);
  }
  return { ok: true, list: { version: 1, blocks } };
}

/**
 * Parse page body to BlockList (version + blocks as BlockNode[]).
 * Used by Editor2 and _stubs tryParseBlockListFromBody.
 * Fails explicitly when format is unsupported or blocks are invalid.
 */

import { extractBlocksSource } from "@/lib/cms/extractBlocksSource";
import type { BlockList, BlockNode } from "@/lib/cms/model/blockTypes";
import { parseBlockConfig } from "@/lib/cms/design/designContract";

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function toBlockNode(raw: unknown): BlockNode | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = safeStr(o.id);
  const type = safeStr(o.type);
  if (!id || !type) return null;
  const config = parseBlockConfig(o.config);

  if (o.data != null && typeof o.data === "object" && !Array.isArray(o.data)) {
    return {
      id,
      type,
      data: o.data as Record<string, unknown>,
      ...(config ? { config } : {}),
    };
  }
  const { id: _id, type: _type, config: _cfg, ...rest } = o;
  return {
    id,
    type,
    data: rest && typeof rest === "object" && !Array.isArray(rest) ? (rest as Record<string, unknown>) : {},
    ...(config ? { config } : {}),
  };
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
